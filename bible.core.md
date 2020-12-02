# Migration/Update Etherpad Core

Docs.plus roadmap for migrating and updating etherpad core,

- Create a new branch from master, like `update`
- Then clone new version of etherpad in there
- After all, change and modify these files according to the instructions below.

``` bash
replace:    ~\src\templates\index.html
modify:     ~\src\node\hooks\express\specialpages.js    # tag by @Samir
modify:     ~\src\node\handler\PadMessageHandler.js     # tag by @Samir
modify:     ~\src\node\db\API.js                        # tag by @Samir
modify:     ~\src\static\js\chat.js                     # tag by @Samir
```
