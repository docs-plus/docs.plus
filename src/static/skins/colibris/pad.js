function customStart()
{
  $('#pad_title').show();
  $('#pad_title').prepend('<img class="logo" src="../static/images/logo.png?v=<%=settings.randomVersionString%>">');
  $('.buttonicon').mousedown(function() { $(this).parent().addClass('pressed'); })
  $('.buttonicon').mouseup(function() { $(this).parent().removeClass('pressed'); })
}
