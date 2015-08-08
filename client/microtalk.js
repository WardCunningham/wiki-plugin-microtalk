(function () {

  function escape (text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function emit ($item, item) {
    $item.append("<p>" + escape(item.text || 'empty') + "</p>")
  }

  function bind ($item, item) {
    $item.dblclick(function() {
      return wiki.textEditor($item, item);
    })
  }

  window.plugins.microtalk = {
    emit: emit,
    bind: bind
  }

}).call(this)