/*
    TODO:
        
*/
define(function (require, exports, module) {
    "use strict";
    
    var CommandManager = brackets.getModule("command/CommandManager"),
        Menus          = brackets.getModule("command/Menus"),
        EditorManager  = brackets.getModule('editor/EditorManager'),
        FileUtils      = brackets.getModule("file/FileUtils"),       
        PreferencesManager = brackets.getModule("preferences/PreferencesManager");
    
    
    // gets editor
    window.editor = EditorManager.getActiveEditor();
    
    
    
    
    
    /* ************************************************
        This adds the html to the page and creates Div handle
            -doesn't show bc => display:none;
    */
    function appendHTML(){   
        // get MathJax filePath to pass to mathHTML
        var filePath =  FileUtils.getNativeModuleDirectoryPath(module) + '/MathJax/MathJax.js?config=MMLorHTML';
        
        //add src="filePath" to script tag
        var template = require("text!math.html");
        var tagLocation = template.indexOf('<script');
        template = template.slice(0,tagLocation+7) + " src='"+ filePath +"' " + template.slice(tagLocation+7);
        var mathHTML = $(template);
        
        //append to body
        $('body').append(mathHTML);
    }
    
    appendHTML();
    var mathDiv = $('#mathDiv');
    
    
    
    
    
    
    /* ************************************************
        Handle Preferences
        -Set defaults
        -get preferences
    */
    var prefs = PreferencesManager.getExtensionPrefs("mathViz");
    
    // Dont show these - its regex so escape chars!!  (Ex: Math. => Math\\.)
    prefs.definePreference("dontShow" , "array", ["Math\\."],{
                                        description: "Dont show in final display",
                                        valueType: "string"
    });

    // Dont Escape - Convert to Other Form (theta => ϴ)
    prefs.definePreference("dontEscape","array", ["arccos","theta"],{
        description: "For full list of escaped chars, go to defs.json file",
        valueType: "string"
    });
    
    prefs.definePreference("replace","object",{arcsin:"Math.asin",
                                               arccos:"Math.acos",
                                               arctan:"Math.atan"});
    
    var cssPrefHandle = prefs.definePreference("style","object",{
        rightOffset: 45,
        mathDivCSS:  {},
        equationsCSS:{},
        commentsCSS: {}
    });
    
    
    // get prefs
    var dontShow = prefs.get("dontShow"); 
    var dontEscape = prefs.get('dontEscape').concat(['sin']);
    var replaceObj = prefs.get('replace');
    var cssPrefs = prefs.get('style');
    
    
    
    
    
    
    /* ***********************************************
        Handle Css Prefs, then changes
    */
    
    var cssMathDiv = Object.assign({
                'position'      : 'absolute',
                'display'       : 'none',
                'margin-top'    :'1.5em',
                'padding'       : '10px',
                'padding-right' : '15px',
                'z-index'       :'150',
                'background'    : '#d8dcc6',
                'border'        :  '1px solid #595959',
                'border-radius' : '15px',
                'color'         : 'black',
                'font-size'     : '1.5em'
    }, cssPrefs.mathDivCSS);
    var cssEquations = Object.assign({},cssPrefs.equationsCSS);
    var cssComments = Object.assign({
                'margin-top': '50px',
                'font-size': '.8em',
                'color': '#353535'
    },cssPrefs.commentsCSS);
    var rightOffset = cssPrefs.rightOffset;
    
    
    function cssChanges(){
        
        var cssPrefsNow = prefs.get('style');
        
        Object.assign( cssMathDiv, cssPrefsNow.mathDivCSS);
        Object.assign( cssEquations, cssPrefsNow.equationsCSS);
        Object.assign( cssComments, cssPrefsNow.commentsCSS);
        
        rightOffset = cssPrefsNow.rightOffset;
                
    }
    
    
    cssPrefHandle.on('change',cssChanges);
    
    
    
    
    
    
    /* ************************************************
        Get Special Sequences to escape (defs.json)
    */
    
    var json_file = require('text!defs.json');
    var escapeArray = JSON.parse(json_file).escapes;
    for(var i=0; i<dontEscape.length; i++){ 
        escapeArray = escapeArray.filter(val => val !== dontEscape[i]);
    }
    


        
    
    
    
    /* ************************************************
        Main Functions:
        
        1) find the equations
        2) format them
        3) set the display location 
        4) sets the css values
        5) show the Math
        6) Hides math when screen is clicked
    */
        
    //returns array of equations (1 for each line)
    function findEquation(){
        
        /*  New Method
            if(multiple lines, get each separately)
        */
        var pos = editor.getSelection(true);
        var lineNum = pos.start.line;
        var allLines = [];
        do{
            var lineContent = editor._codeMirror.getLine(lineNum).trim();
            if(lineContent != ""){
                // gets rid off: 'var' ';'
                lineContent = lineContent.replace(/^var /,"").replace(/;$/,"");
                allLines.push(lineContent);
            }
            lineNum++;
        } while(lineNum <= pos.end.line);
        
        return(allLines);
    }
    
    //convert js to MathJax readable format (Ascii)
    function formatEquation(fullEquation){
        /**************************
        * How equations are formatted:
        *   1) Remove all Spaces
        *   2) Math.pow(bs,exp) => bs^exp
        *   3) Math.logb(x) => log_b(x)
        *   4) Replacements (replacement : toReplace)
        *   5) Delte sequences from dontShow[]
        *   6) Disguise sequences from dontEscape[i] as => &&i&& 
        *   7) Escape special char sequences (from defs.json)
        *   8) unDisguise dontEscape[] sequences
        *   9) add () for division so it doesn't cut words
        *   10) add () to underScores so it doesn't cut words
        *   11) convert PI to pi (so it shows symbol)
        */  
        
        var newEq = fullEquation.replace(/ /g,"");
        
        
        //convert Math.pow(var,3) => var^3
        var powPos = newEq.indexOf('Math.pow(');
        while(powPos>=0){
            var commaPos = newEq.indexOf(',',powPos);
            var parenPos = newEq.indexOf(')',commaPos);
            
            var base = newEq.substring(powPos+9,commaPos)
            var expo = newEq.substring(commaPos+1,parenPos);
            var newFormat = `(${base})^(${expo})`;
            
            newEq = newEq.replace(`Math.pow(${base},${expo})`, newFormat);
            
            powPos = newEq.indexOf('Math.pow(');
        }
        
        
        
        //convert Math.log()
        var logPos = newEq.indexOf('Math.log');
        while(logPos>=0){
            var parPos = newEq.indexOf('(',logPos);
            
            if((parPos-logPos) > 8){
                //log has base
                
                if((newEq[parPos-1]) == 'p'){
                    
                    //log1p()
                    newEq = newEq.slice(0,logPos+8) + '_e(1+' + newEq.slice(parPos+1);
                }else{
                    newEq = newEq.slice(0,logPos+8) + "_" + newEq.slice(logPos+8);
                }
            }else{
                //base e
                newEq = newEq.slice(0,logPos+8) + "_e" + newEq.slice(logPos+8);
            }
            
            var logPos = newEq.indexOf('Math.log',parPos);
            
        }
        
        
        
        //replacements (Math.acos => arccos)
        for(var replacement in replaceObj){
            var regEx = new RegExp(replaceObj[replacement],'g');            
            newEq = newEq.replace(regEx,replacement);
        }
        
        
        
        //delete sequences from dontShow array
        for(var i = 0; i<dontShow.length; i++){    
            var regEx = new RegExp(dontShow[i],'g');            
            newEq = newEq.replace(regEx,"");
        }
        
        
        
        //Disguise sequences in dontEscape[] as => &&index&& (so they dont escape)
        for(var i = 0; i<dontEscape.length; i++){
            var replacement = '&&' +i+ '&&';
            
            // operators or undefined on both sides
            var reStr = "(^|[<>+=/*)(\-_])" + dontEscape[i] + "([<>+=/*)(\-_]|$)";
            var regEx = new RegExp(reStr,'g');
            
            var pos = newEq.search(regEx);   
            while(pos > -1){
                if(pos != 0){ pos++; }
                newEq = newEq.slice(0,pos) + replacement + newEq.slice(pos+dontEscape[i].length);
                pos = newEq.search(regEx);
            }
        }
        
        
        
        // escape special char sequences
        for(var i=0; i<escapeArray.length; i++){
            
            var escapeStr = escapeArray[i];
            var regEx = new RegExp(escapeStr,'g');
            
            //check if they are in equation
            if(newEq.search(regEx) == -1){ continue; }
            
            escapeStr = escapeStr.replace('\\',"");
            var replaceArray = escapeStr.split("");
            var foo = [];
            
            for(var n=0;n<replaceArray.length;n++){
                foo.push(replaceArray[n]);
                if(n<replaceArray.length-1) { foo.push("\\"); }
            }
            var replacement = foo.join("");
            newEq = newEq.replace(regEx,replacement);
            
            if(newEq.search(regEx) != -1){
                //for 3 letters 'nnn' (bc only first 2 register as nn group)
                newEq = newEq.replace(regEx,replacement);
            }
        }
        
        
        
        //unDisguise sequences from dontEscape Array
        for(var i = 0; i<dontEscape.length; i++){
            
            // only the strings by themselves (operators on both sides)
            var regEx = new RegExp('&&'+i+'&&','g');
            newEq = newEq.replace(regEx,dontEscape[i]);
        }
       

        
        //add () for division (if not, it splits vars)
        var divisPos = newEq.indexOf('/');
        while(divisPos >= 0){
            var fore = newEq[divisPos-1];
            var aft = newEq[divisPos+1];
            var pos = divisPos;
            
            //before division
            if(fore != ")"){
                newEq = newEq.slice(0,pos) + ')' + newEq.slice(pos);
                
                while(newEq[pos].search(/([^+\-=/<>*(])/) >= 0){
                    pos--;
                }
                newEq = newEq.slice(0,pos+1) + '(' + newEq.slice(pos + 1);
                pos = divisPos + 3;
            }
            
            //after division
            if(aft != "("){
                newEq = newEq.slice(0,pos) + '(' + newEq.slice(pos);
                var opens = 0;
                var closes = 0;
                var end = false;
                
                while( end==false ){
                    pos++;
                    
                    if(typeof newEq[pos] == "undefined"){ break; }
                    
                    //check for operators
                    end = (newEq[pos].search(/[+\-=/<>*]/) >= 0);
                    
                    //check for matching ()
                    if(newEq[pos] == "("){ opens++; }
                    else if(newEq[pos] == ")"){ closes++; }
                    if(opens != closes){ end = false; }
                      
                }
                
                
                newEq = newEq.slice(0,pos) + ')' + newEq.slice(pos);
            }
            divisPos = newEq.indexOf('/',pos+1);
        }
        
        
        //convert PI to pi
        var posPI = newEq.indexOf('PI');
        if(posPI >= 0){
            var regEx = new RegExp('PI','g');            
            newEq = newEq.replace(regEx,"pi");
        }
        
        
        
        //fix underscores
        var _Pos = newEq.indexOf('_');
        while(_Pos >=0){
            var endPos = _Pos+1;
            while(typeof newEq[endPos] != 'undefined' && newEq[endPos].search(/[^(+\-=/<>*]/) >=0 ){
                endPos++;   
            }
            
            var newEquation = newEq.slice(0,_Pos+1) + "(" + newEq.slice(_Pos+1,endPos);
                newEquation += ")" + newEq.slice(endPos);
            
            newEq = newEquation;
            _Pos = newEq.indexOf('_',_Pos+2);
        }
        
        
        return(newEq);
    }
    
    // sets Div location (1=> at cursor, multiple => at right)
    function setCoords(numOfEqs){
        
        var css = {};
        
        
        //get cursor offset
        var cursorEl = null;
        var selEl = null;
        if ( $('.active-pane').length ) {
            cursorEl = $('.active-pane .CodeMirror:visible > .CodeMirror-cursors > .CodeMirror-cursor');
            selEl = $('.active-pane  .CodeMirror:visible > div:eq(0) > textarea');
        } else {
            cursorEl = $('.CodeMirror:visible > .CodeMirror-cursors > .CodeMirror-cursor');
            selEl = $('.CodeMirror:visible > div:eq(0) > textarea');
        }
        
        
        // Set top Value
        css.top = cursorEl.length ? cursorEl.offset().top  : ( selEl.offset().top );
        
        
        if(numOfEqs > 1){  
            //Set height
            var divHeight = mathDiv.outerHeight(true);
            var bodyHeight = $('body').outerHeight();
            var heightDif = (divHeight+css.top) - bodyHeight;
            if(heightDif > -100){
                css.height = String(divHeight - heightDif - 75) + 'px';
                css.overflowY = 'scroll';
            }


            // Set left
            var divWidth = mathDiv.outerWidth(true);
            var bodyWidth = $('body').outerWidth(true);
            var widthDif = bodyWidth - divWidth;
            css.left = widthDif - rightOffset;
        }
        else{
            //Set left value
            css.left = cursorEl.length ? cursorEl.offset().left  : ( selEl.offset().left );
        }
        
        mathDiv.css(css);
        
    }
    
    //set css values
    function setCss(){
        
        mathDiv.css(cssMathDiv);
        $('.equations').css(cssEquations);
        $('.comments').css(cssComments);
        
    }
    
    //calls other functions then displays Math
    function showMath(){
        mathDiv.hide();
        var allEquations = findEquation();
        var newEquations = [];
        var numOfEqs = 0;
        
        //return if allEquations is empty;
        if(allEquations.length == 0){ return; }
        
        
        //format equations (skip comments)
        for(var i=0; i<allEquations.length; i++){
            if(allEquations[i].indexOf('//') == -1){
                var newEq = formatEquation(allEquations[i]);
                newEquations.push("<p class='equations'> `" + newEq + "` </p>");
                numOfEqs++;
            }else{
                newEquations.push("<p class='comments' >" + allEquations[i] + "</p>");
            }

        }
        
        
        mathDiv.css({height: 'auto'});
        mathDiv.html(newEquations.join(""));
        mathDiv.trigger('click');
        
        setCss();
        
        
        //waits until mathjax is ready (communicates through input value)
        var commHandle = $('#communicator');
        var intervalId = setInterval(function(){
            if(commHandle.val() == "ready"){
                setCoords(numOfEqs);
                mathDiv.show();
                commHandle.val('notReady');
                clearInterval(intervalId);
            }

        }, 5);

        
    }
        
    //when you click on screen, hide math
    $('.main-view').on('click', function(){
        mathDiv.hide();
    });
    
    
    
    
    
    
    /* ************************************************
        These handle the shortcut command
            -it registers the command
            -then, adds it to menu
                (I don't know of another way to add shortcuts for now)
    */
    
    var menu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
    var MY_COMMAND_ID = "pk.showMath";
    var name = "Show Math";

    //Register Command
    CommandManager.register(name, MY_COMMAND_ID, showMath);

    //add menu item and shortcut
    menu.addMenuItem(MY_COMMAND_ID, "CMD-ALT-M");
    
});
