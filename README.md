# mruby support for VSCode

[日本語の説明はこちら / Japanese](https://github.com/kimushu/vscode-mruby/blob/master/README.ja.md)

This extension provides compiler and runtime of mruby (_Lightweight implementation of Ruby Language_).

https://github.com/kimushu/vscode-mruby

## About mruby

See official website: https://www.mruby.org/

## Features

* Provide tasks for mruby compilation (*.rb &rightarrow; *.mrb)
    * **mruby compiler is included** in this extension. \
      You don't need install mruby separately.
    * **Watch mode** supported. \
      Automatically re-compile after you changed source code. You don't need to trigger build many times.
    * **Report compile errors in VSCode**. \
      When compile errors detected, this extension reports errors on source code and in Problems window.

* Provide **executing your Ruby code with mruby** in VSCode debug interface.

* (Experimental) Provide debugging your Ruby code with mruby debugger ( `mrdb` ) through VSCode debug interface.

## Supported mruby versions

|mruby|RITE binary|RITE VM|Compile support|Execute support|Debug suport|
|:--:|:--:|:--:|:--:|:--:|:--:|
|2.0.0|0005|0002|**Yes**|**Yes**|Yes (Experimental)|
|1.4.1|0004|0000|**Yes**|**Yes**|Yes (Experimental)|
|1.3.0|0004|0000|No|No|No|
|1.2.0|0003|0000|No|No|No|
|1.1.0|0003|0000|No|No|No|
|1.0.0|0002|0000|No|No|No|

## How to configure tasks.json

1. Open Ruby source (.rb) in VSCode.

1. Press `F1` and type `Configure Task`. \
![](https://user-images.githubusercontent.com/1642194/52716366-f4a34a80-2fe1-11e9-9f98-b5a94442103d.png)

1. Select `mruby: Compile with mruby` or `mruby: Compile with mruby (Watch mode)` as you prefer. \
![](https://user-images.githubusercontent.com/1642194/52716215-a2622980-2fe1-11e9-90f4-5bd3e8637e9f.png)

## How to configure launch.json

1. Open Ruby source (.rb) in VSCode.

1. Select `Debug` &rightarrow; `Add configuration...` from menu bar. \
![](https://user-images.githubusercontent.com/1642194/52716548-51066a00-2fe2-11e9-9915-b7b410f8db15.png)

1. Select mruby or mruby debugger. \
![](https://user-images.githubusercontent.com/1642194/52716637-8b700700-2fe2-11e9-868e-02ce59c524fa.png)

## Release Notes

### 1.0.0

Initial release with experimental debugging support.
