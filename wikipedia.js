const builder = require('botbuilder');
const request = require('superagent');
const async = require('async');

// この機能にwikipediaという名前をつける
var lib = new builder.Library('wikipedia');

// 機能を実行する為のキーワードの正規表現
const triggerRegExp = ["(.+)について(教えて|おしえて)$", "^wiki( |　)(.+)"]

// ユーザーの文章から、調べたい検索ワードを抽出する為の正規表現
const ExtractionRegExp = ["について(教えて|おしえて)$", "^wiki( |　)"]

lib.dialog('search', [
    (session, args, next) => {
        // 検索ワードを取得する
        const searchWord = ExtractionSearchWord(session.message.text);

        // wikipediaのapiを実行する
        request.get('https://ja.wikipedia.org/w/api.php')
            .query({
                format: 'json',
                action: 'query',
                prop: "extracts",
                exintro: "true", // booleanの指定に値は関係なく、パラメーターが設定されていれば真と判定される
                explaintext: "true",
                redirects: "true",
                utf8: "true",
                titles: searchWord
            }).end((err, res) => {
                // 検索結果は文字列として処理されているのでJSON形式に変換する
                var pages = JSON.parse(res.text).query.pages;
                var results = [];
                for (var id in pages) {
                    session.send(pages[id].title);
                    session.send(pages[id].extract);
                }
                session.endDialog();
            })
    }

    // この機能を実行するためのトリガーを定義
]).triggerAction({
    matches: [RegExp(triggerRegExp[0]), RegExp(triggerRegExp[1])],
    // デフォルトでは、ダイアログスタックが全て初期化されるため
    // それを回避する為の定義
    onSelectAction: (session, args, next) => {
        session.beginDialog(args.action, args);
    }

    //wikiに関するヘルプを実行する
}).beginDialogAction("WikipediaHelpAction", "wiki_help", {
    matches: /^help$/i,
});

// 検索ワードを取り出す為の関数
function ExtractionSearchWord(message) {
    for (var regExp of ExtractionRegExp) {
        // ユーザーのメッセージから検索ワード以外の文字列を空文字と置換して検索ワードを取り出す
        message = message.replace(RegExp(regExp), "");
    }

    return message;
}

module.exports.createLibrary = function () {
    return lib.clone();
};
