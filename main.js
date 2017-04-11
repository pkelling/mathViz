/*
    TODO:
    -add delete preferences (what I use for ϴ. and S.)
    -add option to remove special chars from escape list (like alpha or epsilon)
    -display options:
        =at right or where clicked? (Default: for 1 line, where clicked, for multiple, at right)
        =distance from right
        =css options (background, font, size....,padding)
    
        
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
        Handle Preferences
        -Set defaults
        -get preferences
    */
    var prefs = PreferencesManager.getExtensionPrefs("math");
    
    // Dont show these - its regex so escape chars!!  (Ex: Math. => Math\\.)
    prefs.definePreference("dontShow" , "array", ["Math\\."],{
                                        description: "This is...",
                                        valueType: "string"
    });

    // Dont Escape - Convert to Other Form (theta => ϴ)
    prefs.definePreference("dontEscape","array", ["theta"],{
        description: "This is...",
        valueType: "string"
    });
    
    prefs.definePreference("replace","object",{
                    arcsin:"Math\\.asin",
                    arccos:"Math\\.acos",
                    arctan:"Math\\.atan"
    });
    
    
    
    // get prefs
    var dontShow = prefs.get("dontShow"); 
    var dontEscape = prefs.get('dontEscape');
    var replaceObj = prefs.get('replace');
    
    
    
    /* ************************************************
        Get Special Sequences to escape (defs.json)
    */
    
    var json_file = require('text!defs.json');
    var escapeArray = JSON.parse(json_file).escapes;
    for(var i=0; i<dontEscape.length; i++){ 
        escapeArray = escapeArray.filter(val => val !== dontEscape[i]);
    }
    
    
    
    
    /* ************************************************
        This adds the html to the page and create Div handle
            -doesn't show bc => display:none;
    */
    
    function appendHTML(){   
        // get MathJax filePath to pass to mathHTML
        var filePath =  FileUtils.getNativeModuleDirectoryPath(module) + '/MathJax/MathJax.js?config=default';
        
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
        These functions:
        
        1) find the equations
        2) format them
        3) set the display location 
        4) show the Math
        5) Hides math when screen is clicked
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
    
    //convert js to MathJax readable format
    function formatEquation(fullEquation){
        
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
        
        
        //Capitalize sequences from dontEscape Array (so they dont escape)
        for(var i = 0; i<dontEscape.length; i++){
            var str = dontEscape[i];
            
            // operators or undefined on both sides
            var reStr = "(^|[<>+=/*()\\-_])" + str + "([<>+=/*()\\-_]|$)";
            var regEx = new RegExp(reStr,'g');
            var pos = newEq.search(regEx);
            
            while(pos>-1){ 
                if(pos != 0){ pos++; }
                newEq = newEq.slice(0,pos) + str.toUpperCase() + newEq.slice(pos+str.length);
                pos = newEq.search(regEx);    
            }
        }
        
        
        // escape special char sequences
        for(var i=0; i<escapeArray.length; i++){
            
            //check if they are in equation
            if(!newEq.includes(escapeArray[i])){ continue; }
            
            var regEx = new RegExp(escapeArray[i],'g');
            var replaceArray = escapeArray[i].split("");
            var foo = [];
            
            for(var n=0;n<replaceArray.length;n++){
                foo.push(replaceArray[n]);
                if(n<replaceArray.length-1) { foo.push("\\") };
            }
            
            var replacement = foo.join("");
            newEq = newEq.replace(regEx,replacement);
        }
        
        
        //unCapitalize sequences from dontEscape Array
        for(var i = 0; i<dontEscape.length; i++){
            var capStr = dontEscape[i].toUpperCase();
            
            // only the strings by themselves (operators on both sides)
            var regEx = new RegExp(capStr,'g');
            newEq = newEq.replace(regEx,dontEscape[i]);
        }
        
        
        //add () for division (if not, it splits vars)
        var divisPos = newEq.indexOf('/');
        while(divisPos >= 0){
            var fore = newEq[divisPos-1];
            var aft = newEq[divisPos+1];
            var pos = divisPos;
            if(fore != ")"){
                newEq = newEq.slice(0,pos) + ')' + newEq.slice(pos);
                
                while(newEq[pos].search(/([^+\-=/<>*(])/) >= 0){
                    pos--;
                }
                newEq = newEq.slice(0,pos+1) + '(' + newEq.slice(pos + 1);
                pos = divisPos + 2;
            }
            
            if(aft != "("){
                pos = pos+1;
                newEq = newEq.slice(0,pos) + '(' + newEq.slice(pos);
                
                while(typeof newEq[pos] != "undefined" && newEq[pos].search(/([^+\-=/<>*)])/) >= 0){
                    pos++;
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
            while(typeof newEq[endPos] != 'undefined' && newEq[endPos].search(/([^+\-=/<>*])/) >=0 ){
                endPos++;   
            }
            
            var newEquation = newEq.slice(0,_Pos+1) + "(" + newEq.slice(_Pos+1,endPos);
                newEquation += ")" + newEq.slice(endPos);
            
            newEq = newEquation;
            _Pos = newEq.indexOf('_',_Pos+2);
        }
        
        console.log(newEq);
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
            var heightDif = (divHeight+top) - bodyHeight;
            if(heightDif > 0){
                css.height = String(divHeight - heightDif - 75) + 'px';
                css.overflowY = 'scroll';
            }


            // Set left
            var divWidth = mathDiv.outerWidth(true);
            var bodyWidth = $('body').outerWidth(true);
            var widthDif = bodyWidth - divWidth;
            css.left = widthDif - 35;
        }
        else{
            //Set left value
            css.left = cursorEl.length ? cursorEl.offset().left  : ( selEl.offset().left );
        }
        
        mathDiv.css(css);
        
    }
    
    //calls other functions then displays Math
    function showMath(){
        mathDiv.hide();
        var allEquations = findEquation();
        var newEquations = [];
        var numOfEqs = 0;
        
        //format equations (skip comments)
        for(var i=0; i<allEquations.length; i++){
            if(allEquations[i].indexOf('//') == -1){
                var newEq = formatEquation(allEquations[i]);
                newEquations.push("<p> `" + newEq + "` </p>");
                numOfEqs++;
            }else{
                newEquations.push("<p class='comments' >" + allEquations[i] + "</p>");
            }

        }
        
        mathDiv.css({height: 'auto'});
        mathDiv.html(newEquations.join(""));
        mathDiv.trigger('click');
        
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
