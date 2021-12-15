[![Generic badge](https://img.shields.io/badge/version-1.8.14-green.svg)](https://docs.plus)
[![MIT license](https://img.shields.io/badge/License-Apache-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)
[![Open Source? Yes!](https://badgen.net/badge/Open%20Source%20%3F/Yes%21/blue?icon=github)](https://github.com/nwspk/docs.plus)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-green.svg)](https://github.com/nwspk/docs.plus/compare)
[![All Contributors](https://img.shields.io/badge/all_contributors-4-blue.svg)](#contributors-)


# 📚 Docs.plus (1.8.15)

**Docs.plus** is a real-time collaborative tools to help communites share knowledge

## About

It is the result of over six years of research by [newspeak.house](https://newspeak.house) into civil society and public sector coordination and crisis response.
It solves many common organising problems, and can be frictionlessly adopted by all typical stakeholders without needing any training.

**Docs.plus** intuitively combines all the common communication tools:

- ✔️ Collaborative documents
- ✔️ Videocalls (with unlimited self-organising breakout rooms)
- ✔️ Group text chat
- ✔️ Search, filtering and tagging
- 🚧 Profiling
- ⏭️ Email subscription
- ⏭️ Mobile and desktop app
- ⏭️ Push notifications
- *Suggest the next feature...*

# Base

**Docs.plus** is built on [Etherpad](https://github.com/ether/etherpad-lite) which is a real-time collaborative editor for the web, our team tweek a etherpad bases for the goal we persude, also we are using combanation of etherpad plugin and custom one to power up our goals.

*Let's go ahead and look at our [Bible](https://github.com/nwspk/docs.plus/blob/master/bible.core.md) to see what changes we are making! [Link](https://github.com/nwspk/docs.plus/blob/master/bible.core.md)*

### Plugins

- [ep_wrtc_heading](https://github.com/HMarzban/ep_wrtc_heading) <sub>*custom build*</sub>
- [ep_headerview](https://github.com/HMarzban/ep_headerview) <sub>*custom build*</sub>
- [ep_table_of_contents](https://github.com/samirsayyad/ep_table_of_contents) <sub>*custom build*</sub>
- [ep_headings2](https://github.com/samirsayyad/ep_headings2) <sub>*custom build*</sub>
- [ep_set_title_on_pad](https://github.com/samirsayyad/ep_set_title_on_pad.git) <sub>*custom build*</sub>
- [ep_insert_media](https://github.com/samirsayyad/ep_insert_media) <sub>*custom build*</sub>
- [ep_full_hyperlinks](https://github.com/samirsayyad/ep_full_hyperlinks) <sub>*custom build*</sub>
- [ep_bottom_chat_bar](https://github.com/samirsayyad/ep_bottom_chat_bar) <sub>*custom build*</sub>
- [ep_custom_header_message](https://github.com/samirsayyad/ep_custom_header_message) <sub>*custom build*</sub>
- [ep_docs_plus_customise](https://github.com/samirsayyad/ep_docs_plus_customize) <sub>*custom build*</sub>
- [ep_loading_pad](https://github.com/samirsayyad/ep_loading_pad.git) <sub>*custom build*</sub>
- [ep_profile_modal](https://github.com/samirsayyad/ep_profile_modal) <sub>*custom build*</sub>
- [ep_adminpads2](https://github.com/rhansen/ep_adminpads2)
- [ep_comments](https://github.com/ether/ep_comments)
- [ep_hide_line_numbers](https://github.com/JohnMcLear/ep_hide_line_numbers)
- [ep_monetization](https://github.com/ISNIT0/ep_monetization)
- [ep_remove_embed](https://github.com/tjwelde/ep_remove_embed)
- [ep_sticky_attributes](https://github.com/JohnMcLear/ep_sticky_attributes)

# 🚀 Prerequisites & Installation
Prerequisites and installation are the same as Etherpad flow, follow this [link](https://github.com/ether/etherpad-lite#installation), or you can follow short steps like the following:

```bash
# clone the project
git clone https://github.com/nwspk/docs.plus.git

# move to the project folder
cd docsplus

# install pre requirement plugins
npm install --no-save --legacy-peer-deps
        npm install --no-save --legacy-peer-deps
        ep_adminpads2
        https://github.com/samirsayyad/ep_rocketchat#f214f48
        https://github.com/ether/ep_comments_page
        https://github.com/ether/ep_cursortrace
        https://github.com/samirsayyad/ep_custom_header_message
        https://github.com/samirsayyad/ep_docs_plus_customize#c68bc28
        https://github.com/samirsayyad/ep_full_hyperlinks#1eb4ecd
        ep_hide_line_numbers
        https://github.com/samirsayyad/ep_insert_media#eecbc98
        https://github.com/samirsayyad/ep_loading_pad#9ae42cd
        ep_monetization
        https://github.com/samirsayyad/ep_profile_modal#10a1e17
        ep_remove_embed
        https://github.com/samirsayyad/ep_headings2#76e3f79
        https://github.com/samirsayyad/ep_set_title_on_pad#e507359
        https://github.com/samirsayyad/ep_table_of_contents#b123e05
        https://github.com/HMarzban/ep_headerview#a4e93eb
        # https://github.com/HMarzban/ep_wrtc_heading#ffb7911
        # https://github.com/ether/ep_sticky_attributes.git

# run the docsplus
src/bin/run.sh
```
> For mor info Take a look at [CI](https://github.com/nwspk/docs.plus/blob/master/.github/workflows/master.yml)

> If you wanna have your Turn/Stun server for the video chat you can follow this installation for the [Coturn](https://github.com/coturn/coturn) server; [Link](https://dev.to/kevin_odongo35/how-to-configure-a-turn-server-3opd). <br>*By default, the video plugin uses a public Stun server [More info](https://github.com/HMarzban/ep_wrtc_heading)*

> If you wanna rocketchat rocketchat .... (Need to check...)

# New features as Integration
Write about new featues more Which makes us more distinct from the Etherpad.

1. Single-pad
2. Rocket chat 🚧
3. Heading filter 🚧
4. Video group 🚧

----
## Rocket Chat

You can use rocket chat integration with ...

----
## Single-pad

You can use docs.plus as a single-pad document also.

1. Add `ep_singlePad` setting to the [settings](https://github.com/nwspk/docs.plus/blob/dev/settings.json) 
```json
"ep_singlePad":{
    "active": false,
    "padId": "padName",
    "padName": "padName"
}
```

2. Then change Nginx config like below: (replace padId)


```bash
......

location / {
        rewrite ^/timeslider(.*) /p/padId/timeslider break;
        rewrite ^/$ /p/padId break;
        rewrite ^/locales/(.*) /locales/$1 break;
        rewrite ^/locales.json /locales.json break;
        rewrite ^/admin(.*) /admin/$1 permanent;
        rewrite ^/admin/(.*) /admin/$1 break;
        rewrite ^/static/(.*) /static/$1 break;
        rewrite ^/pluginfw/(.*) /pluginfw/$1 break;
        rewrite ^/javascripts/(.*) /javascripts/$1 break;
        rewrite ^/socket.io/(.*) /socket.io/$1 break;
        rewrite ^/ep/(.*) /ep/$1 break;
        rewrite ^/minified/(.*) /minified/$1 break;
        rewrite ^/api/(.*) /api/$1 break;
        rewrite ^/ro/(.*) /ro/$1 break;
        rewrite ^/error/(.*) /error/$1 break;
        rewrite ^/jserror(.*) /jserror$1 break;
        rewrite ^/redirect(.*) /redirect$1 break;
        rewrite /favicon.ico /favicon.ico break;
        rewrite /robots.txt /robots.txt break;
        rewrite ^/p/(.*) /p/padId break;
        rewrite ^/(.*) /p/padId1/$1 break; # ======> single-pad <====== #
        proxy_buffering off;
        proxy_set_header Host $host;
        proxy_pass http://localhost:9101;
        proxy_set_header X-Real-IP $remote_addr;  # http://wiki.nginx.org/HttpProxyModule
        proxy_set_header X-Forwarded-For $remote_addr; # EP logs to show the actual remote IP
        proxy_set_header X-Forwarded-Proto $scheme; # for EP to set secure cookie flag when https is used
        proxy_set_header Host $host;  # pass the host header
        proxy_http_version 1.1;  # recommended with keepalive connections
        proxy_pass_header Server;
        # WebSocket proxying - from https://nginx.org/en/docs/http/websocket.html
        proxy_set_header  Upgrade $http_upgrade;
        proxy_set_header  Connection $connection_upgrade;
}

......
```

# 🤝 Contributing
Thank you for your interest in contributing! Please feel free to put up a PR for any issue or feature request.

### ✨ Contributors 
Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

|  |  |  |  |
| --------- | ------ | ----------- | ------------- |
| [<img src="https://avatars.githubusercontent.com/u/5703915?v=4?s=100" width="100"><br> 📆💼 edsaperia](https://github.com/edsaperia) | [<img src="https://avatars.githubusercontent.com/u/11405614?v=4?s=100" width="100"><br>💻🚇 samirsayyad](https://github.com/samirsayyad)  | [<img src="https://avatars.githubusercontent.com/u/20157508?v=4?s=100" width="100"><br>💻🚇Hossein](https://github.com/HMarzban)  | [<img src="https://avatars.githubusercontent.com/u/1060378?v=4?s=100" width="100"><br>🚇Josh Balfour](https://github.com/joshbalfour)  |


# 👋 Contact
If you have any further questions, please don’t hesitate, you can reach us by the following:
- Twitter: [@docsdotplus](https://twitter.com/docsdotplus)
- Github: [docs.plus](https://github.com/nwspk/docs.plus)
- Slack: [docsplus](docsplus.slack.com)
- Email: [contact@newspeak.house](mailto:contact@newspeak.house)

# 📝 License
This project is licensed under the [Apache License v2](http://www.apache.org/licenses/LICENSE-2.0.html) License

# Support
**Docs.plus** is free and open source, please help us stay online:

<a href="https://patreon.com/docsplus"><img src="https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.vercel.app%2Fapi%3Fusername%3Ddocsplus%26type%3Dpatrons&style=for-the-badge" /> </a>

