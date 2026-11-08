## Usage

Shows the status of a machine, an axis or a job in a word or two.

```html
<ds-badge status="ok">Running</ds-badge>
<ds-badge status="warning">Low oil</ds-badge>
<ds-badge status="alarm">Stopped</ds-badge>
<ds-badge>Idle</ds-badge>
```

## Statuses

| Status | Meaning |
| --- | --- |
| `ok` | Normal operation |
| `warning` | Needs attention soon |
| `alarm` | Fault or stop: needs action now |
| none | Neutral information |

## Accessibility

- The color is never the only signal: the text must say the status.
- A badge is not interactive.
