# MMI api — delt lagring i GitHub

Åpent api (ingen innlogging) på Azure Static Web Apps. Lageret er **dette repoet**:
hver lagring skriver prosjektfila på nytt og blir en commit, så git-historikken *er*
revisjonssporet. Ingenting overskrives uten spor.

Bakgrunn for valget: COWI-leietakeren har nøkkelbasert tilgang til lagringskontoer
sperret av policy (`KeyBasedAuthenticationNotPermitted`), og Static Web Apps sine
innebygde funksjoner har ingen identitet å autentisere med Entra ID i stedet.
GitHub-lagring omgår begge problemene uten en eneste ny Azure-ressurs.

## Endepunkter

| Metode | Rute | Gjør |
| --- | --- | --- |
| GET | `/api/state?project=X` | Nyeste versjon med data |
| GET | `/api/state?project=X&head=1` | Bare metadata — ett kall, ingen nedlasting. Konsollen poller med denne |
| GET | `/api/state?project=X&version=<sha>` | En bestemt versjon |
| PUT | `/api/state?project=X` | Ny versjon. Body: `{ "data": {…}, "by": "Navn", "note": "Milepæl" }` |
| GET | `/api/history?project=X&limit=100` | Versjonsliste, nyeste først |
| GET | `/api/projects` | Prosjektfilene som finnes i lageret |
| GET/POST | `/api/presence` | Hvem som er inne nå. POST-body: `{ "project": "X", "id": "<klient-id>", "who": "Navn" }` |

`version` er commit-sha'en.

## Miljøvariabler

Settes på Static Web App-en under **Settings → Environment variables**.

| Navn | Påkrevd | Standard |
| --- | --- | --- |
| `MMI_GITHUB_TOKEN` | ja | — |
| `MMI_REPO` | nei | `OESE-BIM/StoreNorske` |
| `MMI_BRANCH` | nei | `main` |
| `MMI_PATH_PREFIX` | nei | `data/mmi` |

Tokenet skal være en **fine-grained personal access token** med tilgang til bare dette
repoet og bare **Contents: Read and write**. Ingen andre rettigheter trengs.

## Datamodell

Én fil per prosjekt: `data/mmi/<prosjekt>.json`.

```json
{ "savedAt": "2026-08-30T18:00:00.000Z", "by": "Kari", "note": "Milepæl", "data": { … } }
```

Forfatter, notat og innholdstall gjentas i commit-meldingens andre avsnitt som JSON.
Det er grunnen til at historikklista kan bygges fra commit-lista alene, uten å hente
hver enkelt fil — ett API-kall for hele historikken i stedet for ett per versjon.

## Slik bruker konsollen api-et

- Lagrer automatisk 4 sekunder etter siste endring.
- Poller `?head=1` hvert 20. sekund og henter ned data bare når sha'en har endret seg,
  og bare hvis det ikke ligger ulagrede endringer lokalt. Ellers vises «Hent nå».
- «Merk milepæl» lagrer med navn i `note`. Historikkpanelet viser navngitte versjoner
  som standard, resten bak «vis alle versjoner».
- Faller tilbake til ren lokal lagring hvis api-et ikke svarer.

## Grenser å kjenne

- **GitHubs takgrense** er 5 000 kall i timen per token. Med polling på 20 sekunder
  bruker hver åpne fane rundt 180 kall i timen, så det tåler godt over tjue samtidige
  brukere. Blir det trangt, øk pollingintervallet før noe annet.
- **Nærvær ligger i minnet** på funksjonsverten, ikke i git — et livstegn hvert 30.
  sekund ville gitt hundrevis av tomme commits. Lista kan derfor bli ufullstendig ved
  skalering, og nullstilles ved kaldstart. Den er pynt, og tåler det.
- **Ingen samtidighetslås.** To som lagrer i samme sekund gir to commits, og den siste
  vinner i fila. Pollingen fanger det opp innen 20 sekunder, og begge versjoner ligger
  i historikken. Skal det strammes til, sender PUT med forventet sha og får 409 tilbake.
- **Api-et er åpent.** Alle med lenken kan utløse en commit. Funksjonen skriver bare
  under `MMI_PATH_PREFIX`, så skaden er avgrenset til datafilene.

## Neste steg, ikke bygget ennå

- Excel-eksport. Gjøres i nettleseren, ingen serverkode.
- Samtidighetssjekk (forventet sha på PUT, 409 ved kollisjon).
- Sanntid i stedet for polling, hvis 20 sekunder viser seg for tregt.
