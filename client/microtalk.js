(function () {


  // MICROTALK by Alain Marty | updated on 2015/08/15
  // http://epsilonwiki.free.fr/alphawiki_2/?view=microtalk

/////////////////////////////////////////////////////////////////////////////

var dict     = {}; // primitive JS functions
var g_lambda = {}; // user functions
var g_cons   = {}; // user paires
var g_array  = {}; // user arrays

var g_lambda_num = 0;
var g_cons_num   = 0;
var g_array_num  = 0; 

/////////////////////////////////////////////////////////////////////////////
var evaluate = function( str ) {
  var t0 = new Date().getTime();
  var bal = balance( str );   // {} balance control
  if (bal.left != bal.right)
    str = 'none';
  else {
    str = pre_processing(str);
    str = eval_apos( str );    // preventing evaluation
    str = eval_quotes( str );  // preventing evaluation
    str = eval_ifs( str );     // preventing terms evaluation
    str = eval_lets( str );    // defining local variables
    str = eval_lambdas( str ); // binding arguments and body
    str = eval_defs( str );    // extending the dictionary   
    str = eval_sexprs( str );  // now we can evaluate s_exprs
    str = post_processing(str);
  }
  var t1 = new Date().getTime();
  return {val:str, bal:bal, time:t1-t0};
};

/////////////////////////////////////////////////////////////////////////////
var loop_rex = /\{([^\s{}]*)(?:[\s]*)([^{}]*)\}/g;  // Regexp sliding window

var eval_sexprs = function( str ) {  // from sequences words and s_exprs ...
  while (str != (str = str.replace( loop_rex, do_apply ))) ;
  return str;                        // ... to sequences of words (and HTML)
};
var do_apply = function () {
  var first = arguments[1] || '', rest  = arguments[2] || '';
  if (dict.hasOwnProperty( first ))                  // primitive JS functions
     return dict[ first ].apply( null, [rest] );
  // else if (g_lambda.hasOwnProperty( first ))      // slower
  else if (first.substring(0,7) === 'lambda_')       // ugly but faster
     return g_lambda[ first ].apply( null, [rest] ); // user functions
  else
     return '(' + first + ' ' + rest + ')'           // no evaluation
};

/*
var debug = true, loop_index = 0;
var eval_sexprs = function( str ) {
  var s = str.replace( loop_rex, do_apply);
  if (debug) console.log( loop_index++ + ': ' + str + ' | ' + s ); 
  return (s !== str)? eval_sexprs( s ) : s;
};
*/

/////////////////////////////////////////////////////////////////////////////
// eval_apos, eval_quotes, eval_ifs, eval_lambdas, eval_defs, eval_lets
/*
var eval_special_forms = function( str ) {
  var s = catch_sexpression( '{symbol ', str );
  return (s === 'none')? str :
    eval_special_forms( str.replace( 
      '{symbol '+s, eval_special_form( s.trim())));
};
  Sometimes the previous recursive approach leads to a stack overflow on 
  heavy nested structures (lists, ...). The following "while (true)" 
  iterative approach avoids any stack overflow.
*/
var eval_apos = function( str ) {
  while (true) {
    var s = catch_sexpression( "'{", str );
    if (s === 'none') break;
    str = str.replace( "'"+s, hide_braces( s.trim() ) );
  }
  return str;
};
var eval_quotes = function( str ) {
  while (true) {
    var s = catch_sexpression( '{q ', str );
    if (s === 'none') break;
    str = str.replace( '{q '+s+'}', hide_braces( s.trim() ) );
  }
  return str;
};
var eval_ifs = function( str ) { // {if bool then one else two}
  while (true) {
    var s = catch_sexpression( '{if ', str );
    if (s === 'none') break;
    str = str.replace( '{if '+s+'}', eval_if( s.trim() ) );
  }
  return str;
};
var eval_lambdas = function( str ) {
  while (true) {
    var s = catch_sexpression( '{lambda ', str );
    if (s === 'none') break;
    str = str.replace( '{lambda '+s+'}', eval_lambda(s.trim()) );
  }
  return str;
};
var eval_defs = function( str, flag ) {
  flag = (flag === undefined)? true : false;
  while (true) {
    var s = catch_sexpression( '{def ', str );
    if (s === 'none') break;
    str = str.replace( '{def '+s+'}', eval_def( s.trim(), flag ) );
  }
  return str;
};
var eval_lets = function( str ) {
  while (true) {
    var s = catch_sexpression( '{let ', str );
    if (s === 'none') break;
    str = str.replace( '{let '+s+'}', eval_let(s.trim()) );
  }
  return str;
};


/////////////////////////////////////////////////////////////////////////////
var eval_if = function( s ) {
  s = eval_ifs( s );               // nested ifs
  var pif = parse_if( s );
  return '{when ' + pif[0] +
     ' then ' + hide_braces(pif[1]) + ' else ' + hide_braces(pif[2]) + '}';
};
var eval_lambda = function (s) {
  s = eval_lambdas( s );           // nested lambdas
  var name = 'lambda_' + g_lambda_num++,
      args = supertrim( s.substring(1, s.indexOf('}')) ).split(' '),
      body = supertrim( s.substring(s.indexOf('}')+1) );
  for (var reg_args=[], i=0; i < args.length; i++)
    reg_args[i] = RegExp( args[i], 'g');
  g_lambda[name] = function () {
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
  s = eval_defs( s, false );       // nested defs
  var name = s.substring(0, s.indexOf(' ')).trim(),
      body = s.substring(s.indexOf(' ')).trim(); 
  body = supertrim(body);
  // if (g_lambda.hasOwnProperty(body)) {  // slower
  if (body.substring(0,7) === 'lambda_') { // faster
    dict[name] = g_lambda[body];
    delete g_lambda[body];
  } else { 
    dict[name] = function() { return body };
  }
  return (flag)? name : ''; //return '';
};
var eval_let = function (s) {
  s = eval_lets( s );             // nested lets
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

/////////////////////////////////////////////////////////////////////////////
var pre_processing = function( str ) {
  g_lambda_num = 0;
  g_cons_num   = 0;
  g_array_num  = 0;
  str = str.trim() 
           .replace( /Â°Â°Â°[\s\S]*?Â°Â°Â°/g, '' ); // delete Â°Â°Â° comments Â°Â°Â°
//         .replace( /<=/g, '__lte__' )       // prevent "<=" broken in "< ="
//         .replace( /<([^<>]*)>/g, '< $1>' ) // breaks HTML < tags>
//         .replace( /__lte__/g, '<=' );      // retrieve the "<=" operator
  return str;
};
var post_processing = function( str ) {
  g_lambda_num = 0;
  g_array_num = 0;
  g_cons_num = 0;
  for (var key in dict)
    delete g_lambda[key]
  for (var key in g_array)
    delete g_array[key]
  for (var key in g_cons)
    delete g_cons[key]
  return str;
};
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
  while(nb > 0) {
    if (index > 10000) { // debug, prevent an infinite loop
      console.log( 'trouble with catch_sexpression!' ); 
      return 'none';
    }
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

/////////////////////////////////////////////////////////////////////////////
// POPULATING THE DICTIONARY

dict['lib'] = function () { // {lib} -> list the functions in dict
  var str = '', index = 0;
  for (var key in dict) {
    if(dict.hasOwnProperty(key)){
      str += key + ', ';
      index++;
    }
  }
  return '<b>dictionary: </b>(' + 
         index + ') [ ' + str.substring(0,str.length-2) + ' ]<br /> ';
};

dict['when'] = function () { // twinned with {if ...} in eval_ifs()
  var pif = parse_if( arguments[0] );
  return (pif[0] === "true")?  show_braces(pif[1]) : show_braces(pif[2]);
};

// HTML & SVG TAGS
dict['@'] = function () { return '@@' + arguments[0] + '@@' };
var htmltags = 
['div','span','a','ul','ol','li','dl','dt','dd','table','tr','td','br','hr',
'h1','h2','h3','h4','h5','h6','p','b','i','u','pre','center','blockquote',
'sup','sub','del','code','img','textarea','canvas',
'svg','line','rect','circle','polyline','path','text',
'g','animateMotion','mpath','use','textPath'];
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

// JS MATH OBJECT FUNCTIONS
var mathtags = // one argument
['abs','acos','asin','atan', 'atan2', 'ceil','cos','exp', 
'floor','log','random','round','sin','sqrt','tan'];
for (var i=0; i< mathtags.length; i++) {
  dict[mathtags[i]] = Math[mathtags[i]]
}

// two or more arguments
dict['pow'] = function () { 
  var args = arguments[0].split(' ');
  return Math.pow(parseFloat(args[0]),parseFloat(args[1])) 
};
dict['min'] = function () { 
  var args = arguments[0].split(' ');
  return Math.min.apply(Math, args);
};    
dict['max'] = function () { 
  var args = arguments[0].split(' ');
  return Math.max.apply(Math, args);
};    
dict['PI'] = function () { return Math.PI };
dict['E'] = function ()  { return Math.E };

// BASIC ARITHMETIC OPERATORS made variadic, ie. {* 1 2 3 4 5 6} -> 720
dict['+'] = function() { 
  var args = arguments[0].split(' ');
  if (args.length == 2) return Number(args[0]) + Number(args[1]);
  for (var r=0, i=0; i< args.length; i++) 
    r += Number(args[i]); 
  return r; 
};
dict['*'] = function() { 
  var args = arguments[0].split(' ');
  if (args.length == 2) return args[0] * args[1];
  for (var r=1, i=0; i< args.length; i++)
    if (args[i] !== '') 
      r *= args[i]; 
  return r; 
};
dict['-'] = function () { // (- 1 2 3 4) -> 1-2-3-4
  var args = arguments[0].split(' ');
  if (args.length == 2) return args[0] - args[1];
  var r = args[0];
  if (args.length == 1) 
    r = -r;  // case (- 1) -> -1
  else
    for (var i=1; i< args.length; i++) 
      r -= args[i]; 
  return r; 
};
dict['/'] = function () { // (/ 1 2 3 4) -> 1/2/3/4
  var args = arguments[0].split(' ');
  if (args.length == 2) return args[0] / args[1];
  var r = args[0];
  if (args.length == 1) 
    r = 1/r;  // case (/ 2) -> 1/2
  else
    for (var i=1; i< args.length; i++)
      if (args[i] !== '') 
        r /= args[i]; 
  return r; 
};
dict['%']  = function() { 
  var args = arguments[0].split(' '); 
  return parseFloat(args[0]) % parseFloat(args[1]) 
};

// BOOLEANS
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

// SOME OTHERS
dict['serie'] = function () { // {serie start end step}
  var args = supertrim(arguments[0]).split(' ');
  var start = parseFloat( args[0] ),
      end  = parseFloat( args[1] ),
      step = parseFloat( args[2] || 1 ),
      str  = '';
  if (start < end && step > 0) {
    for (var i=start; i <= end; i+= step) 
      str += i + ' ';
  } else if (start > end && step < 0) {
    for (var i=start; i >= end; i+= step) 
      str += i + ' ';
  } else 
    str = 'start, end and step are non compatible! ';
  return str.substring(0, str.length-1);
};
dict['map'] = function () { // {map func serie}
  var args = supertrim(arguments[0]).split(' ');
  var func = args.shift();
  g_lambda['map_temp'] = g_lambda[func]; // if it's a lambda it's saved in map_temp
  for (var str='', i=0; i< args.length; i++)
    str += g_lambda['map_temp'].call( null, args[i] ) + ' ';
  delete g_lambda['map_temp'];       // clean map_temp
  return str.substring(0, str.length-1);
};
dict['reduce'] = function () { // {reduce *userfunc* serie}
  var args = supertrim(arguments[0]).split(' ');
  var func = args.shift();
  var res = '{{' + func + ' ' + args[0] + '}';
  for (var i=1; i< args.length-1; i++)
    res = '{' + func + ' ' + res + ' ' + args[i] + '}';
  res += ' ' + args[args.length-1] + '}';
  return res;
};

dict['date'] = function () { 
  var now = new Date();
  var year    = now.getFullYear(), 
      month   = now.getMonth() + 1, 
      day     = now.getDate(),
      hours   = now.getHours(), 
      minutes = now.getMinutes(), 
      seconds = now.getSeconds();
  if (month<10) month = '0' + month;
  if (day<10) day = '0' + day;
  if (hours<10) hours = '0' + hours;
  if (minutes<10) minutes = '0' + minutes;
  if (seconds<10) seconds = '0' + seconds;
  return year+' '+month+' '+day+' '+hours+' '+minutes+' '+seconds;
};  

dict['eval'] = function() { // {eval hidden expression}
  var args = supertrim(arguments[0]); 
  return show_braces( args ); 
};

// SENTENCES first, rest, nth, length
dict['first'] = function () { // {first a b c d} -> a
  var args = arguments[0].split(' ');
  return args[0];
}
dict['rest'] = function () { // {rest a b c d} -> b c d
  var args = arguments[0].split(' ');
  return args.slice(1).join(' ');
}
dict['nth'] = function () { // {nth 1 a b c d} -> b
  var args = arguments[0].split(' ');
  return args[args.shift()];
}
dict['length'] = function () { // {length a b c d} -> 4
  var args = arguments[0].split(' ');
  return args.length;
}

// STRINGS equal?, empty?, chars, charAt
dict['equal?'] = function() { // {equal? word1 word2}
  var args = supertrim(arguments[0]).split(' '); 
  return (args[0] === args[1])? 'true' : 'false'; 
};

dict['empty?'] = function() { // {empty? string}
  return arguments[0] === ''; 
};
dict['chars'] = function() {  // {chars some text}
  return arguments[0].length; 
};
dict['charAt'] = function() { // {charAt i some text}
  var terms = arguments[0].split(' '), // ["i","some","text"]
      i = terms.shift(),
      s = terms.join(' ');
  return s.charAt(parseInt(i)); 
};

// CONS CAR CDR LIST
// var g_cons  = {}, g_cons_num = 0;
// testing ( z.substring(0,5) === 'cons_' ) is faster than
// testing ( g_cons.hasOwnProperty(z) )

dict['cons'] = function () { // {cons 12 34} -> cons_123
  var args = supertrim(arguments[0]).split(' ');
  var name = 'cons_' + g_cons_num++; // see eval_special_forms()
  g_cons[name] = function(w) { return (w === 'true')? args[0] : args[1] };
  return name;
};
dict['cons?'] = function () { // {cons? z}
  var z = arguments[0];
  return ( z.substring(0,5) === 'cons_' )? 'true' : 'false';
};
dict['car'] = function () { // {car z}
  var z = arguments[0];
  return ( z.substring(0,5) === 'cons_' )? g_cons[z]('true') : z;
};
dict['cdr'] = function () { // {cdr z}
  var z = arguments[0];
  return ( z.substring(0,5) === 'cons_' )? g_cons[z]('false') : z;
};
dict['cons.disp'] = function () { // {cons.disp {cons a b}} 
  var args = supertrim(arguments[0]);
  var r_cons_disp = function (z) {
    if ( z.substring(0,5) === 'cons_' )
      return '(' + r_cons_disp( g_cons[z]('true') ) + ' ' 
                 + r_cons_disp( g_cons[z]('false') ) + ')';
    else
      return z;
  };
  return r_cons_disp( args );
};
dict['list.new'] = function () {  // {list.new 12 34 56 78} -> cons_123
  var args = supertrim(arguments[0]).split(' '); // [12,34,56,78]
  var r_list_new = function (arr) {
    if (arr.length === 0)
      return 'nil';
    else
      return '{cons ' + arr.shift() + ' ' + r_list_new( arr ) + '}';
  };
  return r_list_new( args );
};
dict['list.disp'] = function () {  // {list.disp {list.new 12 34 56 78}}
  var r_list_disp = function (z) {
    if (z === 'nil')
      return '';
    else
      return g_cons[z]('true') + ' ' + r_list_disp( g_cons[z]('false') );
  };
  var args = supertrim(arguments[0]);
  if ( args.substring(0,5) !== 'cons_' )
    return args
  else 
    return '(' + supertrim( r_list_disp( args.split(' ') ) ) + ')';
};

// ARRAYS (... it's a work in progress ...)
// var g_array = {}, g_array_num = 0;
dict['array.new'] = function () { // {array.new [12,[34,56],78]}
  var args = supertrim(arguments[0]);       // "[12,[34,56],78]"
  var name = '#' + g_array_num++;           // #123
  g_array[name] = (args !== '[]')? JSON.parse( args ) : [];
  return name;                              // -> #123
};
dict['array.disp'] = function () {          // {array.disp {A}}
  var args = supertrim(arguments[0]);       // #123 or val
   if (g_array.hasOwnProperty(args))
    return JSON.stringify( g_array[args] ); // -> "[12,[34,56],78]"
  else
    return args;                            // val
};
dict['array.first'] = function () {         // {array.first {A}}
  var args = supertrim(arguments[0]);       // #123
  return g_array[args][0];                  // 12
};
dict['array.rest'] = function () {          // {array.rest {A}}
  var args = supertrim(arguments[0]);       // #123
  var name = '#' + g_array_num++;           // #124
  g_array[name] = g_array[args].slice(1);   // [[34,56],78]
  return name;                              // #124
};
dict['array.length'] = function () {        // {array.length {A}}
  var args = supertrim(arguments[0]);
  return g_array[ args ].length;
}; 
dict['array.null?'] = function () {         // {array.null {A}}
  var args = supertrim(arguments[0]);
  return (JSON.stringify( g_array[args] ) === '[]')? 'true' : 'false';
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
      '<tr><td style="white-space: pre-wrap;">' + escape(item.text) +
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