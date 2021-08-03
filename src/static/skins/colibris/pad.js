'use strict';

window.customStart = () => {
  const staticRoot = clientVars.staticRootAddress
  $('#pad_title').show();
  $('#pad_title').prepend(`<a href="${staticRoot}"><img class="logo" src="${staticRoot}/static/images/logo.png"> </a>`);
  $('.buttonicon').mousedown(function () { $(this).parent().addClass('pressed'); });
  $('.buttonicon').mouseup(function () { $(this).parent().removeClass('pressed'); });
};
