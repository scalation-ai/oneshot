# Security

Please do not report a security problem in a public issue. Email **security@scalation.ai**. Our
disclosure policy is at https://app.scalation.ai/security/disclosure.txt.

## What oneshot reaches over the network

oneshot runs on your computer and sends nothing to Scalation. It fetches:

- npm packages and Playwright's headless Chrome, during setup;
- the Kokoro voice model, only when you turn narration on;
- Google Fonts stylesheets, when it reads a product's fonts;
- the pages you ask it to capture.
