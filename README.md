# trashtitanstn

## IndexNow

Bing and other IndexNow engines are notified when pages on tntrashtitans.com change.

The API key is the 32-character hex file at the repository root:

`492b2c4c1ac0968875879f970cb83b2e.txt`

Netlify publishes this repository from the root (`publish = "."` in `netlify.toml`), so that file is served unchanged at:

https://tntrashtitans.com/492b2c4c1ac0968875879f970cb83b2e.txt

The file contains only the key. Its filename and contents have to match.

**Production deploys ping IndexNow automatically.** The plugin in `netlify/plugins/indexnow` runs after a production deploy succeeds, reads `sitemap.xml`, and POSTs those URLs to `https://api.indexnow.org/indexnow` with host `tntrashtitans.com` and the key location above. Deploy previews and branch deploys do not ping. If the ping fails, the site still stays up; the deploy log shows a warning.

To submit the sitemap yourself (after the key file is live):

```bash
node scripts/indexnow.js
```

`node scripts/indexnow.js --dry-run` prints the URL count and key location and does not call the API.

`200` means the URLs were accepted. `202` means they were received and key verification is still pending, which is normal the first time the key file is fetched. `403` means the key file is not publicly reachable yet.