## last commit ID

> This commit ID is the latest changes we have from etherpad

[020f5ff730bf1c9905ded4e6fde45c35d60cc63c](https://github.com/ether/etherpad-lite/commit/020f5ff730bf1c9905ded4e6fde45c35d60cc63c)

# Migration/Update Etherpad Core

Docs.plus roadmap for migrating and updating etherpad core,

- Create a new branch from master, like `update`
- Then clone new version of etherpad in there
- After all, change and modify these files according to the instructions below.

``` bash
replace:    ~\src\templates\index.html                  # just for meta
modify:    ~\src\templates\pad.html                     # just for meta & static root
replace:    ~\src\static\css
copy:       ~\src\static\images
replace:    ~\src\static\font
replace:    ~\src\static\skins\colibris
replace:    ~\src\static\favicon.ico
modify:     ~\src\node\hooks\express\specialpages.js    # tag by @Samir
modify:     ~\src\node\handler\PadMessageHandler.js     # tag by @Samir
modify:     ~\src\node\db\API.js                        # tag by @Samir
modify:     ~\src\static\js\chat.js                     # tag by @Samir
replace:    ~\settings.json to                          # "title": "${TITLE:docs.plus | Loading...}",
modify      ~\start.bat                                 # tag by @Hossein
modify      ~\bin\run.sh                                # tag by @Hossein
modify      ~\bin\installDeps.sh                        # tag by @Hossein
modify      ~\bin\installOnWindows.bat                  # tag by @Hossein
modify      ~\src\static\js\ace2_inner.js               # tag by @Hossein customElements
modify      ~\src\static\js\ace2_inner.js               # tag by @Hossein customElements
modify      ~\src\templates\pad.html                    # tag by @Samir change loading block - going to top after body
modify      ~\src\static\js\pad.js                      # tag by @Samir - change error to reconnect and socket config
add:        ~\src\templates\pad.html                    # GA code @Samir
modify      ~\src\static\js\domline.js                  # @Samir - commented because want to process on copied external link
modify      ~\src\node\utils\toolbar.js                 # @Samir - toolbar divider changes
```

## Custom Upgrade

```bash
modify ~\src\node\hooks\i18n.js                         # tag by @Hossein, change locale static routers
modify ~\src\node\hooks\express\importexport.js         # tag by @Hossein, change import&export routers
modify ~\src\node\hooks\express\specialpages.js         # tag by @Hossein, change serving pad routers
modify ~\src\node\hooks\express\ExportHtml.js           # tag by @Hossein
create ~\src\node\utils\nestedPad.js                    # tag by @Hossein, helper for generating padId, padName, padView
modify ~\src\node\Settings.js                           # tag by @Hossein
modify ~\src\static\js\ace.js                           # tag by @Hossein, absUrl fn
modify ~\src\static\js\pad_impexp.js                    # tag by @Hossein, location.path replace
modify ~\src\static\js\pad_utils.js                     # tag by @Hossein, static root
modify ~\src\static\js\pad.js                           # tag by @Hossein, clientVars, padId
modify ~\src\static\js\timeslider.js                    # tag by @Hossein, clientVars, padId
modify ~\src\templates\export_html.html                 # tag by @Hossein, padId => padName
modify ~\src\templates\pad.html                         # tag by @Hossein, put staticRoot, padId, padName, PadView to clientvars
```

>NOTE: In some cases the `modify` must be evaluated! Because in that case some cases may be broken!
