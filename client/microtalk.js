(function () {

  /* MICROTALK Â© marty.alain@free.fr 20150718 */

  var dict    = {}, g_lambda_num = 0;
  var g_array = {}, g_array_num  = 0;

  var evaluate = function( str ) {
    var t0 = new Date().getTime();
    var bal = balance( str );
    if (bal.left != bal.right)
      str = 'none';
    else {
      g_lambda_num = 0;
      g_array_num  = 0;
      str = eval_apos( str );
      str = eval_quotes( str );
      str = eval_ifs( str );
      str = eval_lets( str );
      str = eval_lambdas( str );
      str = eval_defs( str );
      str = eval_sexprs( str );
    }
    var t1 = new Date().getTime();
    return {val:str, bal:bal, time:t1-t0};
  };

  var eval_sexprs = function( str ) {
    var loop_rex = /\{([^\s{}]*)(?:[\s]*)([^{}]*)\}/g;
    while (str != (str = str.replace( loop_rex, do_apply ))) ;
    return str;
  };
  var do_apply = function () {
    var first = arguments[1] || '', rest  = arguments[2] || '';
    if (dict.hasOwnProperty( first ))
       return dict[ first ].apply( null, [rest] )
    else
       return '(' + first + ' ' + rest + ')'
  };

  var eval_apos = function( str ) {
    var s = catch_sexpression( "'{", str );
    return (s === 'none')? str :
      eval_apos( str.replace( "'"+s, hide_braces( s.trim())));
  };
  var eval_quotes = function( str ) {
    var s = catch_sexpression( '{q ', str );
    return (s === 'none')? str :
      eval_quotes( str.replace( '{q '+s+'}', hide_braces( s.trim())));
  };
  var eval_ifs = function( str ) {
    var s = catch_sexpression( '{if ', str );
    return (s === 'none')? str :
      eval_ifs( str.replace( '{if '+s+'}', eval_if( s.trim())));
  };
  var eval_lambdas = function( str ) {
    var s = catch_sexpression( '{lambda ', str );
    return (s === 'none')? str :
      eval_lambdas( str.replace( '{lambda '+s+'}', eval_lambda(s.trim())))
  };
  var eval_defs = function( str, flag ) {
    flag = (flag === undefined)? true : false;
    var s = catch_sexpression( '{def ', str );
    return (s === 'none')? str :
      eval_defs( str.replace( '{def '+s+'}', eval_def( s.trim(), flag)));
  };
  var eval_lets = function( str ) {
    var s = catch_sexpression( '{let ', str );
    return (s === 'none')? str :
      eval_lets( str.replace( '{let '+s+'}', eval_let(s.trim())));
  };

  var eval_if = function( s ) {
    s = eval_ifs( s );
    var pif = parse_if( s );
    return '{when ' + pif[0] +
       ' then ' + hide_braces(pif[1]) + ' else ' + hide_braces(pif[2]) + '}';
  };
  var eval_lambda = function (s) {
    s = eval_lambdas( s );
    var name = 'lambda_' + g_lambda_num++,
        args = supertrim( s.substring(1, s.indexOf('}')) ).split(' '),
        body = supertrim( s.substring(s.indexOf('}')+1) );
    for (var reg_args=[], i=0; i < args.length; i++)
      reg_args[i] = RegExp( args[i], 'g');
    dict[name] = function () {
      var vals = supertrim(arguments[0]).split(' ');
      return function (bod) {
        if (vals.length < args.length) {
          for (var i=0; i < vals.length; i++)
            bod = bod.replace( reg_args[i], vals[i] );
            var _args = args.slice(vals.length).join(' ');
            bod = eval_lambda( '{' + _args + '}' + bod );
        } else { // vals.length >= args.length, ignore extra values
          for (var i=0; i < args.length; i++)
            bod = bod.replace( reg_args[i], vals[i] );
        }
        return bod;
      }(body);
    };
    return name;
  };
  var eval_def = function (s, flag) {
    s = eval_defs( s, false );
    var name = s.substring(0, s.indexOf(' ')).trim(),
        body = s.substring(s.indexOf(' ')).trim();
    body = supertrim(body);
    if (dict.hasOwnProperty(body)) {
      dict[name] = dict[body];
      delete dict[body];
    } else {
      dict[name] = function() { return body };
    }
    return (flag)? name : '';
  };
  var eval_let = function (s) {
    s = eval_lets( s );
    s = supertrim( s );
    var varvals = catch_sexpression( '{', s );
    var body = supertrim( s.replace( varvals, '' ) );
    varvals = varvals.substring(1, varvals.length-1);
    var avv = [], i=0;
    while (true) {
      avv[i] = catch_sexpression( '{', varvals );
      if (avv[i] === 'none') break;
      varvals = varvals.replace( avv[i], '' );
      i++;
    }
    for (var one ='', two='', i=0; i<avv.length-1; i++) {
      var index = avv[i].indexOf( ' ' );
      one += avv[i].substring( 1, index ) + ' ';
    two += avv[i].substring(index+1, avv[i].length-1) + ' ';
    }
    return '{{lambda {'+ one + '} ' + body + '} ' + two + '}';
  };

  // helper functions

  var supertrim = function (str) {
    return str.trim().replace(/\s+/g, ' ')
  };
  var balance = function ( str ) {
    var acc_strt    = str.match( /\{/g ),
        acc_stop    = str.match( /\}/g ),
        nb_acc_strt = (acc_strt)? acc_strt.length : 0,
        nb_acc_stop = (acc_stop)? acc_stop.length : 0;
    return {left:nb_acc_strt, right:nb_acc_stop};
  };
  var catch_sexpression = function( symbol, str ) {
    var start = str.indexOf( symbol );
    if (start == -1) return 'none';
    var d0, d1, d2;
    if (symbol === "'{")     { d0 = 1; d1 = 1; d2 = 1; }
    else if (symbol === "{") { d0 = 0; d1 = 0; d2 = 1; }
    else                     { d0 = 0; d1 = symbol.length; d2 = 0; }
    var nb = 1, index = start+d0;
    while(nb > 0) { if (index > 10000) {console.log( 'ooops' ); return 'none';}
      index++;
           if ( str.charAt(index) == '{' ) nb++;
      else if ( str.charAt(index) == '}' ) nb--;
    }
    return str.substring( start+d1, index+d2 );
  };
  var hide_braces = function( s ) { // deactivate s-exprs
    return s.replace( /\{/g, '&#123;' ).replace( /\}/g, '&#125;' );
  };
  var show_braces = function( s ) { // reactivate s-exprs
    return s.replace(/&#123;/g, '{').replace(/&#125;/g, '}')
  };
  var parse_if = function(s) {
    var index1 = s.indexOf( 'then' ),
        index2 = s.indexOf( 'else' ),
        bool_term = s.substring(0,index1).trim(),
        then_term = s.substring(index1+5,index2).trim(),
        else_term = s.substring(index2+5).trim();
    return [bool_term, then_term, else_term]
  };

  // populating the dictionary

  dict['lib'] = function () { // {lib} -> list the functions in dict
    var str = '', index = 0;
    for (var key in dict) {
      if(dict.hasOwnProperty(key) && !key.match('lambda_') ){
        str += key + ', ';
        index++;
      }
    }
    return '<b>dictionary: </b>(' +
           index + ') [ ' + str.substring(0,str.length-2) + ' ]<br /> ';
  };

  dict['when'] = function () { // twinned with if in eval_ifs()
    var pif = parse_if( arguments[0] );
    return (eval_sexprs(pif[0]) === "true")?
      eval_sexprs(show_braces(pif[1])) : eval_sexprs(show_braces(pif[2]));
  };

  dict['@'] = function () { return '@@' + arguments[0] + '@@' };
  var htmltags =
  ['div','span','ul','ol','li','dl','dt','dd','table',
  'tr','td','h1','h2','h3','h4','h5','h6','p','b','i','u','pre',
  'center','sup','sub','del','blockquote','img','a','br'];
  for (var i=0; i< htmltags.length; i++) {
    dict[htmltags[i]] = function(tag) {
      return function() {
        var attr = arguments[0].match( /@@[\s\S]*?@@/ );
        if (attr == null)
          return '<'+tag+'>'+arguments[0]+'</'+tag+'>';
        arguments[0] = arguments[0].replace( attr[0], '' ).trim();
        attr = attr[0].replace(/^@@/, '').replace(/@@$/, '');
        return '<'+tag+' '+attr+'>'+arguments[0]+'</'+tag+'>';
      }
    }(htmltags[i]);
  }

  var arithtags = ['+','-','*','/','%'];
  for (var i=0; i< arithtags.length; i++) {
    dict[arithtags[i]] = function(tag) {
      return function() {
        var args = arguments[0].split(' ');
        return eval( args[0] + tag + args[1] );
      }
    }(arithtags[i]);
  }

  var mathtags =
  ['abs','acos','asin','atan','ceil','cos','exp',
  'floor','log','random','round','sin','sqrt','tan'];
  for (var i=0; i< mathtags.length; i++) {
    dict[mathtags[i]] = function(tag) {
      return function() { return tag.apply( null, arguments );}
    }(Math[mathtags[i]]);
  }

  dict['>'] = function() {
    var terms = arguments[0].split(' ');
    return parseFloat(terms[0]) > parseFloat(terms[1])
  };
  dict['<'] = function() {
    var terms = arguments[0].split(' ');
    return parseFloat(terms[0]) < parseFloat(terms[1])
  };
  dict['='] = function() {
    var terms = arguments[0].split(' ');
    var a = parseFloat(terms[0]), b = parseFloat(terms[1]);
    return !(a < b) && !(b < a)
  };
  dict['not'] = function () {
    return (arguments[0] === 'true') ? 'false' : 'true';
  };
  dict['or'] = function () {
    var terms = arguments[0].split(' ');
    for (var ret='false', i=0; i< terms.length; i++)
      if (terms[i] == 'true')
        return 'true';
    return ret;
  };
  dict['and'] = function () { // (and (= 1 1) (= 1 2)) -> false
    var terms = arguments[0].split(' ');
    for (var ret='true', i=0; i< terms.length; i++)
      if (terms[i] == 'false')
        return 'false';
    return ret;
  };

  dict['serie'] = function () { // {serie start end step}
    var args = supertrim(arguments[0]).split(' ');
    var start = parseFloat( args[0] ),
        end = parseFloat( args[1] ),
        step = parseFloat( args[2] || 1 );
    for (var str='', i=start; i<=end; i+= step)
      str += i + ' ';
    return str.substring(0, str.length-1);
  };
  dict['map'] = function () { // {map func serie}
    var args = supertrim(arguments[0]).split(' ');
    var func = args.shift();
    dict['map_temp'] = dict[func]; // if it's a lambda it's saved in map_temp
    for (var str='', i=0; i< args.length; i++)
      str += dict['map_temp'].call( null, args[i] ) + ' ';
    delete dict['map_temp'];       // clean map_temp
    return str.substring(0, str.length-1);
  };

  dict['reduce'] = function () { // {reduce *userfunc* serie}
    var args = supertrim(arguments[0]).split(' ');
    var func = args.shift();
    var res = '{{' + func + ' ' + args[0] + '}';
    for (var i=1; i< args.length-1; i++)
      res = '{' + func + ' ' + res + ' ' + args[i] + '}';
    res += ' ' + args[args.length-1] + '}';
    return eval_sexprs(res);
  };

  dict['equal?'] = function() { // {equal? word1 word2}
    var args = supertrim(arguments[0]).split(' ');
    return (args[0] === args[1])? 'true' : 'false';
  };

  /////////////////////////////////////////////////////////////////
  // var g_array = {}, g_array_num = 0;

  dict['array.new'] = function () { // {array.new [12,[34,56],78]}
    var args = supertrim(arguments[0]);
    var name = '#' + g_array_num++;
    if (args === '[]')
      g_array[name] = [];
    else
      g_array[name] = JSON.parse( args );
    return name;                    // -> #123
  };

  dict['array.disp'] = function () {          // {array.disp {A}}
    var args = supertrim(arguments[0]);
    if (g_array[args] !== undefined)
      return JSON.stringify( g_array[args] ); // -> [12,[34,56],78]
    else
      return args;
  };

  dict['array.length'] = function () {        // {array.length {A}}
    var args = supertrim(arguments[0]);
    return g_array[ args ].length;
  };

  dict['array.get'] = function () {           // {array.get i {A}}
    var args = supertrim(arguments[0]).split(' '); // [ i , {A} ]
    var i = args[0];
    var arr  = g_array[args[1]];
    if (Array.isArray( arr[i] )) {
      var name = '#' + g_array_num++;
      g_array[name] = arr[i];
      return name;
    } else {
      return arr[i];
    }
  };

  dict['array.first'] = function () {         // {array.first {A}}
    var args = supertrim(arguments[0]);
    var name = '#' + g_array_num++;
    g_array[name] = g_array[args][0];
    return name;
  };

  dict['array.rest'] = function () {          // {array.rest {A}}
    var args = supertrim(arguments[0]);
    var name = '#' + g_array_num++;
    g_array[name] = g_array[args].slice(1);
    return name;
  };


  // expose microtalk as wiki plugin

  function escape (text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function output (item) {
    var output = evaluate(item.text);
    var summary = '{' + output.bal.left + '|' + output.bal.right + '} | ' + output.time + ' ms';
    if (output.bal.left === output.bal.right)
      return output.val
    else
      return 'does not compute ' + summary
  }

  function emit ($item, item) {
    $item.append(
      '<table style="width:100%; background:#eee; padding:.8em; margin-bottom:5px;">' +
      '<tr><td>' + escape(item.text) +
      '<tr><td style="background-color:#ddd;padding:15px;">' + output(item)
    )
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