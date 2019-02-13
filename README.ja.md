# mruby support for VSCode

[English](https://github.com/kimushu/vscode-mruby/blob/master/README.md)

この拡張機能は、mruby (軽量Ruby言語) のコンパイラおよびランタイムを提供します。

https://github.com/kimushu/vscode-mruby

## mrubyについて

公式サイトを参照ください: https://www.mruby.org/

## 機能

* mrubyのコンパイル(*.rb &rightarrow; *.mrbへの変換)に関するタスクを提供します。
    * **mrubyコンパイラが拡張機能に内蔵されています。**\
      別途mrubyをインストールする必要はありません。
    * **ウォッチモードをサポートしています。**\
      コードの変更を検知し、自動で再コンパイルします。何度もビルド実行の操作をする必要はありません。
    * **問題をVSCode上で指摘します。**\
      コンパイルエラーがあれば、VSCodeのソースコード表示と「問題」ウィンドウでエラーの場所と内容を指摘します。

* VSCodeデバッグ画面を用いて**mrubyでRubyのコードを実行する機能を提供します**。

* (実験的機能) VSCodeデバッグ画面上で、mrubyデバッガを用いたデバッグ機能を提供します。

## mrubyのバージョン別サポート状況

|mruby|RITE binary|RITE VM|Compile support|Execute support|Debug suport|
|:--:|:--:|:--:|:--:|:--:|:--:|
|2.0.0|0005|0002|**Yes**|**Yes**|Yes (Experimental)|
|1.4.1|0004|0000|**Yes**|**Yes**|Yes (Experimental)|
|1.3.0|0004|0000|No|No|No|
|1.2.0|0003|0000|No|No|No|
|1.1.0|0003|0000|No|No|No|
|1.0.0|0002|0000|No|No|No|

## tasks.jsonの構成の仕方

1. Rubyソースコード(.rb)をVSCodeで開いて下さい。

1. `F1`を押し、`Configure Task`と入力して出てきた項目を選んで下さい。\
![](https://user-images.githubusercontent.com/1642194/52718101-04bd2900-2fe6-11e9-948a-6011dd0fc672.png)

1. `mruby: Compile with mruby`または`mruby: Compile with mruby (Watch mode)`を選択してください。\
![](https://user-images.githubusercontent.com/1642194/52718260-667d9300-2fe6-11e9-84b3-3c0511893a21.png)

## launch.jsonの構成の仕方

1. Rubyソースコード(.rb)をVSCodeで開いて下さい。

1. メニューから `デバッグ` &rightarrow; `構成の追加...` を選択してください。\
![](https://user-images.githubusercontent.com/1642194/52718360-9cbb1280-2fe6-11e9-969c-09ebd4cbb354.png)

1. `mruby`または`デバッガ付きmruby`を選択してください。\
![](https://user-images.githubusercontent.com/1642194/52718436-d0963800-2fe6-11e9-895c-2fc8caf86c2f.png)

## リリースノート

### 1.0.0

初版リリース。(試験的なデバッグ機能付き)
