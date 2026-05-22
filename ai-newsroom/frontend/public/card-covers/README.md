# Card cover pool

News cards without a real `cover_image` use this local static pool.

Expected files:

- `large/001.jpg` through `large/040.jpg`
- `wide/001.jpg` through `wide/060.jpg`
- `tall/001.jpg` through `tall/040.jpg`
- `normal/001.jpg` through `normal/060.jpg`

The frontend maps each card to one image deterministically by card id and card size.
