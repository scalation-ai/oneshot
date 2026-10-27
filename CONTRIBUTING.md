# Contributing to oneshot

Thank you for helping.

## Set up

```
git clone https://github.com/scalation-ai/oneshot
bash oneshot/skills/oneshot/engine/setup.sh
```

`setup.sh` installs the engine and runs its self-test. The self-test builds, checks, reads and
scores a throwaway film. Run it again before you open a pull request; CI runs the same test.

## What a change must keep

- **Sounds are CC0 only.** Each new file's source and original name go in
  `skills/oneshot/engine/sounds/LICENSE.md`, converted the way that file describes.
- **Fonts and data carry an open licence,** with the licence file next to them.
- **Templates, examples and tests use invented numbers and names,** never a real product's data.

## Pull requests

- Make one change per pull request.
- Say what a film looks or sounds like before and after. A still or a short clip helps.
- By submitting a pull request, you license your contribution under Apache-2.0 (section 5 of
  [LICENSE](LICENSE)).
