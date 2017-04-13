mathDisplay is a brackets extension that displays javascript math in an easy to understand way.   

To use, just hit CMD-ALT-M while the cursor is on line line you want.     
For multiple lines, hightlight the equations you want, and hit CMD-ALT-M.

<img src="wiki/images/singleLine.png" width="400"/>
 <img src="wiki/images/multiLine.png" width="800"/>


The following preferences are allowed:

    "math.dontShow": [
        "Math\\.",
        "S\\.",
        "ϴ\\."
    ],
    "math.replace": {
        "arcsin": "ϴ\\.asin",
        "arccos": "ϴ\\.acos",
        "arctan": "ϴ\\.atan",
        "arcsin": "Math\\.asin",
        "arccos": "Math\\.acos",
        "arctan": "Math\\.atan"
    },
    "math.style": {
        "mathDiv": {
            "css": {}
        },
        "equations": {
            "css": {
                "font-size": "50px"
            }
        },
        "comments": {
            "css": {}
        },
        "rightOffset": 45
        
    },
    "math.dontEscape": ["theta"]
