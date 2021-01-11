function customStart()
{
  $('#pad_title').show();
  $('#pad_title').prepend('<a href="../../"><img class="logo" src="../static/images/logo.png"> </a>');
  $('.buttonicon').mousedown(function () { $(this).parent().addClass('pressed'); })
  $('.buttonicon').mouseup(function () { $(this).parent().removeClass('pressed'); })
}
