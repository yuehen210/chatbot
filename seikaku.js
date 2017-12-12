const builder = require('botbuilder');

// このライブラリにseikakuという名前をつける
var lib = new builder.Library('seikaku');

//質問内容を定義
const question = [
    "ラーメン好きですか？",
    "焼肉好きですか？",
    "天ぷら好きですか？",
    "もつ鍋好きですか？",
    "寿司すきですか？"
];

// ユーザーに問いかける際のメッセージと回答に関連する情報を定義する
const menu = {
    "YES": {
        score: 1
    },
    "NO": {
        score: -1
    }
}

// 機能が呼び出される文字列の正規表現 (開始と入力されると実行する)
const triggerRegExp = "開始"

// ライブラリにダイアログを定義する
// 機能が開始して最初のダイアログを定義している
lib.dialog('20Q', [
    (session, args, next) => {
        // 第２引数がユーザーへの問いかけ
        // 第３引数がユーザーの選択肢
        builder.Prompts.choice(session, "準備はいいですか？", ["START", "CANCEL"]);
    },
    (session, res, next) => {
        // ユーザーの回答で処理を振り分け
        switch (res.response.entity) {
            // ゲームを開始する
            case "START":
                session.send("始めます！");
                session.privateConversationData.question_num = 0;
                session.privateConversationData.score = 0;

                // ゲームを実際に開始する
                // 20Q_questionと名前の付いたダイアログをスタックに追加する
                session.beginDialog("20Q_question");
                break;

            case "CANCEL": // 中止することをユーザーに伝え、会話を終了する
                session.endConversation("中止します");
                break;
        }
    },
    (session, args, next) => {
        // スコアを確認してユーザーがイメージした物を回答する
        if (session.privateConversationData.score > 4) {
            session.send("好きなのは食べ物しかないね。健康に悪いからもう一度最初からやります！");
	　　session.privateConversationData.question_num=0;
            session.beginDialog("20Q_question");
        }else if(session.privateConversationData.score < 0){
            session.send("何で好きじゃないの？もう一度最初からやります！");
	　　session.privateConversationData.question_num=0;
            session.beginDialog("20Q_question");
        }else {
            //scoreが0だった時は回答不能
            session.endConversation("あなたが何をイメージしているのか分からない...")
        }
    },

    // この機能を実行するためのトリガーを定義
]).triggerAction({
    matches: [RegExp(triggerRegExp)],
    confirmPrompt: "20Qゲームを始めますか？"

    // 20Q実施中にヘルプが打たれたら、20Qに関するヘルプを実行する
}).beginDialogAction("20QHelpAction", "Help:help_20Q", {
    matches: /^help$/i,

    // ゲームを途中で中止させる為のキーワードと処理を定義
}).cancelAction('cancel20Q', "キャンセルしました", {
    // キャンセルのトリガーとなるパターンを定義
    matches: /^cancel|^stop|^end/i,
    // キャンセルを再度確認する為にユーザーへ送信される文字列
    confirmPrompt: "20Qを終了しますか？",
});

// 20q_question
lib.dialog("20Q_question", [
    (session, args) => {
        // ゲームが正常に開始されているかを判定
        if (session.privateConversationData.hasOwnProperty("question_num")) {
            // 現在の質問番号を取得する
            var question_num = session.privateConversationData.question_num

            //次の質問をユーザーに送信する
            session.send("Q" + (question_num + 1) + ":" + question[question_num]);

            //yes no の選択肢をユーザーに送信する
            builder.Prompts.choice(session, "YES or NO!", menu);

        } else { // question_numが格納されていない場合は処理に問題があったということ
            session.send("ゲームに問題が有りました。")
            session.endConversation("中止します");
        }
    },
    // yes no の回答をユーザーが行った時の処理
    (session, results) => {
        if (results.response) {
            // 回答をもとにスコアを計算する
            session.privateConversationData.score += menu[results.response.entity].score;

            //現在の質問番号を加算する
            session.privateConversationData.question_num++;

            // 全て質問したかをチェック
            if (session.privateConversationData.question_num >= question.length) {
                // 質問するダイアログ終了する
                session.endDialog();

            } else {
                // まだ質問が終わっていないので、繰り返す
                session.replaceDialog("20Q_question");
            }
        }
    }
]);
module.exports.createLibrary = function () {
    return lib.clone();
};
