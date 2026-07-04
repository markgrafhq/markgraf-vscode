# Markgraf Markdown Preview test

```markgraf
seed 1

scene first {
  + api: API
  + db: Database
  + api -> db

  api ~> db |SELECT user|
}
```
