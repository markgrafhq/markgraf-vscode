# Markgraf Markdown Preview test

```markgraf
seed 1

keyframe first {
  +node api "API"
  +node db "Database"
  +edge api db

  api -> db |SELECT user|
}
```
