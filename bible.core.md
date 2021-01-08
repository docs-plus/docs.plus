## last commit ID

> This commit ID is the latest changes we have from etherpad

[4332affba6264cc886878b36873266f9e1dbc457](https://github.com/ether/etherpad-lite/commit/2c8769a6fd9fa4ed36ed6e32ba0826037795fb37)

# Migration/Update Etherpad Core

Docs.plus roadmap for migrating and updating etherpad core,

- Create a new branch from master, like `update`
- Then clone new version of etherpad in there
- After all, change and modify these files according to the instructions below.

``` bash
replace:    ~\src\templates\index.html                  # just for meta
replace:    ~\src\templates\pad.html                    # just for meta
replace:    ~\src\static\css
replace:    ~\src\static\font
replace:    ~\src\static\skins
replace:    ~\src\static\favicon.ico
modify:     ~\src\node\hooks\express\specialpages.js    # tag by @Samir
modify:     ~\src\node\handler\PadMessageHandler.js     # tag by @Samir
modify:     ~\src\node\db\API.js                        # tag by @Samir
modify:     ~\src\static\js\chat.js                     # tag by @Samir
replace:     ~\settings.json to                         #  "title": "${TITLE:docs.plus | Loading...}",
modify  ~\bin\run.sh # tag by @Hossein
modify  ~\bin\installDeps.sh # tag by @Hossein
```
