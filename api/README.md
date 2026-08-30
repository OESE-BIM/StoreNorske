# MMI api — delt lagring

Åpent api (ingen innlogging) på Azure Static Web Apps, med Azure Table Storage som lager.
Ingenting overskrives og ingenting slettes fysisk: hver lagring legger til en ny versjon,
og sletting setter bare et flagg.

## Sett opp (én gang)

1. Lag en lagringskonto i Azure (Storage account, type StorageV2, LRS er nok).
2. Kopier tilkoblingsstrengen: Storage account → Access keys → Connection string.
3. Static Web App → Configuration → legg til:

       AZURE_STORAGE_CONNECTION_STRING = <tilkoblingsstrengen>

4. Push til `main`. Workflowen plukker opp `api/` automatisk fordi
   `api_location` settes til `"api"` (se under).

## Endring som må gjøres i workflowen

I `.github/workflows/azure-static-web-apps-nice-smoke-0e7348a03.yml`:

       api_location: "api"      # var ""

## Endepunkter

| Metode | Rute | Hva den gjør |
| --- | --- | --- |
| GET | `/api/state?project=A302973` | Nyeste versjon |
| GET | `/api/state?project=A302973&version=<v>` | En bestemt versjon |
| PUT | `/api/state?project=A302973` | Legger til ny versjon. Body: `{ "data": {...}, "by": "Navn", "note": "" }` |
| GET | `/api/history?project=A302973&limit=50` | Versjonsliste med sammendrag |
| POST | `/api/mark` | Myk sletting. Body: `{ "project": "...", "version": "<v>", "by": "Navn" }` |
| GET | `/api/projects` | Alle prosjekter i lageret |
| GET/POST | `/api/presence` | Hvem som er inne nå. POST-body: `{ "project": "...", "id": "<klient-id>", "who": "Navn" }` — svarer med lista uansett metode |

`project` er AO-nummeret. `data` er samme objekt som ligger i `.mmi.json`-fila
(feltet `data` der), så fil og api er samme format.

## Datamodell

En rad per lagring:

- **PartitionKey** — prosjekt (AO-nummer)
- **RowKey** — 13 sifre, synkende tid, så nyeste kommer først uten sortering
- **savedAt** — ISO-tid
- **by** — navnet brukeren har skrevet inn i konsollen
- **deleted** — flagg, aldri fysisk sletting
- **payload0…N** — tilstanden som JSON, delt i biter à 30 KB

## Kjør lokalt

    cd api
    npm install
    # legg AZURE_STORAGE_CONNECTION_STRING i local.settings.json
    func start

## Nærvær

Egen tabell `MmiPresence`, én rad per nettleser (`RowKey` = klient-id fra localStorage).
Konsollen sender livstegn hvert 30. sekund; rader eldre enn 90 sekunder regnes som borte
og ryddes bort fortløpende. Ingen historikk, ingen personopplysninger utover navnet
brukeren selv har skrevet inn.

## Slik bruker konsollen api-et

- Lagrer automatisk 4 sekunder etter siste endring.
- Spør etter nyeste versjon hvert 12. sekund og henter den automatisk
  **hvis** det ikke ligger ulagrede endringer lokalt. Ellers vises et varsel med «Hent nå».
- «Merk milepæl» lagrer med et navn i `note`. Historikkpanelet viser navngitte
  versjoner som standard, resten bak «vis alle versjoner».
- Faller tilbake til ren lokal lagring hvis api-et ikke svarer.

## Neste steg, ikke bygget ennå

- **Sanntid mellom brukere.** Polling er på plass (12 sekunder). Azure Web PubSub er
  neste nivå, og bør vente til polling viser seg å ikke være nok.
- **Excel-eksport.** Gjøres billigst i nettleseren fra samme data — ingen serverkode.
- **Samtidighet.** `PUT` bør sende med versjonen du leste (`ifVersion`), så to
  personer som skriver samtidig får beskjed i stedet for at siste vinner blindt.
  Dette er den ene tingen som bør på plass før flere enn en håndfull bruker det.
