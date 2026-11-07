## Usage

Groups content that belongs together, such as the readings of one machine or the settings of one axis. Use the heading to name the group.

```html
<ds-card heading="Axis 1">
  <p>Position 120.5 mm, speed 40 mm/s.</p>
</ds-card>
```

## Variants

| Variant | When |
| --- | --- |
| `default` | Most groups: a flat panel with a border |
| `raised` | One group that must stand out from the others on the page |

```html
<ds-card heading="Current job" variant="raised">
  <p>Program 42, piece 3 of 10.</p>
</ds-card>
```

## Accessibility

- The heading is an `h2`: check that it fits the heading order of the board.
- A card is not clickable. Put a native `<button>` or link inside it for actions.

## Do and don't

- **Do** keep one topic per card.
- **Don't** nest cards inside cards.
