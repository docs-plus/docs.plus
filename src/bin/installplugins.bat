:: Change directory to etherpad-lite root
cd /D "%~dp0..\.."

npm install --no-save --legacy-peer-deps^
    ep_adminpads2^
    https://github.com/samirsayyad/ep_rocketchat#3abdabf^
    https://github.com/ether/ep_comments_page^
    https://github.com/ether/ep_cursortrace^
    https://github.com/samirsayyad/ep_docs_plus_customize#c68bc28^
    ep_hide_line_numbers^
    https://github.com/samirsayyad/ep_insert_media#eecbc98^
    ep_monetization^
    https://github.com/samirsayyad/ep_profile_modal#e2090e2^
    ep_remove_embed^
    https://github.com/samirsayyad/ep_loading_pad#90f43f9^
    https://github.com/samirsayyad/ep_full_hyperlinks#de9a062^
    https://github.com/samirsayyad/ep_headings2#2081555^
    https://github.com/samirsayyad/ep_set_title_on_pad#1085515^
    https://github.com/samirsayyad/ep_table_of_contents#bd11fb9^ 
    https://github.com/HMarzban/ep_headerview#124637e^ 
    https://github.com/HMarzban/ep_wrtc_heading#3e200bb^

cd /D node_modules
mklink /D "ep_etherpad-lite" "..\src"
