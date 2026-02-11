# Flash

Private file sharing built on Storacha and UCAN.

Files are encrypted client-side, stored on IPFS via Storacha, and shared through UCAN delegation tokens embedded in the link. No server controls access the link itself is the authorization.

Private sharing in a flash.

## How it works

1. Sender authorizes with Storacha using their email (`client.login`). This creates a DID identity and a storage space via the W3UP protocol.
2. File is encrypted in the browser using AES-256-GCM (Web Crypto API). If a password is set, the key is derived via PBKDF2 (100k iterations, SHA-256). Otherwise a random key is generated and exported.
3. Encrypted blob is uploaded to IPFS through Storacha's client (`client.uploadFile`), returning a CID.
4. A UCAN delegation is created containing the decryption metadata (IV, key or salt) in its `facts` field. The delegation is signed by the sender's DID key and serialized to base64.
5. A share link is constructed: `/view?cid=<CID>&d=<UCAN_DELEGATION>&filename=<NAME>&type=<MIME>`
6. Recipient opens the link. The UCAN delegation is deserialized, its signature is verified, expiration is checked, and decryption params are extracted. The file is fetched from IPFS gateways, decrypted, and displayed.

## UCAN delegation

The core of the sharing mechanism is `client.createDelegation()` from `@storacha/client`. Each share link contains a self-contained UCAN token that encodes:

- **Issuer**: The sender's DID (who created the delegation)
- **Audience**: Either an ephemeral ed25519 key (open link) or a `did:mailto:` principal (restricted to a specific email)
- **Capability**: `upload/list`
- **Expiration**: Unix timestamp, baked into the token
- **Facts**: Object containing `iv`, `key` (or `salt` if password-protected), and `restricted` flag

On the receiving end, `@ucanto/core/delegation` extracts the token, `@ipld/dag-ucan` verifies the ed25519 signature and checks expiration. If the delegation has a `did:mailto:` audience, the viewer must verify their email through Storacha's login flow — their returned account DID is compared against the delegation's audience DID.

No server is involved in access control. The UCAN token is self-certifying.

## Access modes

| Mode | How it works |
|---|---|
| Open link | Random ed25519 audience. Decryption key is in the UCAN facts. Anyone with the link can decrypt. |
| Email-restricted | Audience is `did:mailto:user@domain`. Viewer must verify email via Storacha before decryption params are used. |
| Password-protected | Key is derived from password via PBKDF2. Only the salt and IV are stored in UCAN facts, not the key. |
| Email + password | Viewer must verify email first, then enter the password. Both gates must pass. |

## Tech stack

- React 19 + Vite
- Tailwind CSS 4
- `@storacha/client` — Storacha W3UP client for storage and UCAN delegation
- `@ucanto/core` — UCAN delegation serialization/deserialization
- `@ucanto/principal` — DID key generation, ed25519 signing, `did:mailto` absentee principals
- `@ipld/dag-ucan` — Signature verification and expiration checks
- `@storacha/did-mailto` — Email to/from `did:mailto:` conversion
- Web Crypto API — AES-256-GCM encryption, PBKDF2 key derivation

## File structure

```
src/
  utils/
    storacha.js    — Client init, auth, upload, download, UCAN delegation create/extract
    encryption.js  — AES-GCM encrypt/decrypt, PBKDF2 key derivation, base64 helpers
  pages/
    Upload.jsx     — Auth flow, file selection, encryption, upload, link generation
    View.jsx       — Link parsing, UCAN verification, email/password gates, decryption, preview
  App.jsx          — Router (/ and /view)
```

## IPFS gateways

Downloads try multiple gateways in order:
1. `storacha.link`
2. `ipfs.io`


## Run locally

```
npm install
npm run dev
```

Requires a Storacha account. The sender must verify their email on first use.

## Security notes

- Encryption happens entirely in the browser. The server never sees plaintext.
- UCAN delegations are signed with ed25519. Tampering is detected on the view side.
- Password-protected files never store the derived key anywhere — only the salt.
- Expiration is enforced client-side via the UCAN token's `exp` field.
- Email-restricted links require the viewer to complete Storacha's email verification flow, which returns a DID that must match the delegation's audience.
