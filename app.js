// region ***** require *****
// 必要な外部機能を定義
const restify = require('restify');
const builder = require('botbuilder'); // MBF本体のライブラリ
const scheduler = require('node-schedule');
const request = require('superagent');

// endregion

//region ***** Server セットアップ *****/
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log("Server Start");
});
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID, // MBFPortalに作成したボットのID
    appPassword: process.env.MICROSOFT_APP_PASSWORD // MBFPortalに作成したボットのPassword
});

server.post('/', connector.listen()); // 例：https://xxx.co.jp/
//endregion

//region ***** Bot セットアップ ***** /

// チャットを受け付けた時の基本的な応答を定義する
// 会話が初期状態の時、ここからはじまる
// ダイアログスタックの一番底にあるもの
var bot = module.exports = new builder.UniversalBot(connector, [
    (session, args, next) => {

        // ユーザー情報をリセットするためのコマンドを定義
        if (session.message.text == "オブビリエイト") {
            // ユーザー情報をすべてリセット
            session.userData = {};
            // 忘れたことをユーザーに伝える
            session.endConversation("＼(゜ロ＼)ココハドコ? (／ロ゜)／アタシハダレ?");
            return;

        } // ユーザーに設定されている情報を表示させる為のコマンドを定義
        else if (session.message.text == "myData") {
            for (var k in session.userData) {
                session.send(k + ": " + session.userData[k]);
            }
            return;
        }
        //ユーザーと会話をするのが初めてなのかどうかを判定
        //初回時はisKownというパラメータは存在しないため、undefinedでfalseになる
        if (session.userData.isKnown) {
            // すでに知っている場合は挨拶をする
            session.send(session.userData.name + "さん　こんにちは！");
        } else {
            // 初めてのユーザーなので、情報を提供してもらう
            session.beginDialog("firstTime");
        }
    }
]);

// 初回ユーザーとの会話を定義
bot.dialog("firstTime", [
    (session, args, next) => {
        session.send("はじめまして！");
        // ユーザーに名前の入力を求める
        // 以下の場合、ユーザーからの情報をテキストとして扱う
        // 他にも number などが有り、numberの場合は半角数字以外が入力された時
        // 自動的に再入力を求めるようになる
        builder.Prompts.text(session, "あなたの名前は何ですか？")
    },
    // ユーザーから期待する返事が来た時の処理を定義
    (session, results, next) => {
        // 返事をそのまま名前として保存する
        session.userData.name = results.response;
        // すでに知っているユーザーであることを設定する
        session.userData.isKnown = true;
        // ユーザーのidを設定する
        session.userData.id = createPrivateid(10);

        // 挨拶をする
        session.send(session.userData.name + "さん　よろしくお願いします！");
        session.endConversation("私が持つ機能を知りたい場合は「help」と入力してください");
    }
]).triggerAction({
    matches: /^hello$/i,
    confirmPrompt: "ok?"
});

// wikipedia検索機能を定義したファイルを読み込む
bot.library(require('./wikipedia').createLibrary());
// 20Q機能を定義したファイルを読み込む
bot.library(require('./20Q').createLibrary());
// help機能を定義したファイルを読み込む
bot.library(require('./help').createLibrary());

// 会話に変化があった時の処理を記述する(例：会話に入っているユーザーが増えた、減った)
bot.on('conversationUpdate', function (message) {});
//endregion

//region ***** CustomAction の設定 *****
// ボットに対して任意のメッセージが飛んできた時の処理を定義する

// リマインドの登録
bot.customAction({
    // 正規表現で指定する
    matches: /^remind ([1-2]|)[0-9]:[0-9][0-9] (.+)$/i,

    // 呼び出された時の処理
    onSelectAction: (session, args, next) => {
        const request = session.message.text.split(" ");
        const TIME = 1;
        const MESSAGE = 2;

        // 現在の日時を取得
        var today = new Date();

        // 時分を抽出する
        var time = request[TIME];

        // 時間のみを抽出する
        var hour = time.split(":")[0];
        // 分のみを抽出する
        var min = time.split(":")[1];

        // 予約時間を設定する
        today.setHours(hour, min);

        // リマインド時に使用するメッセージを抽出する
        var message = request[MESSAGE];

        // キャンセルで指定するようのidを作成
        const reservationId = createPrivateid(5);

        // 予約を登録する
        var reservation = scheduler.scheduleJob(reservationId, {
            year: today.getFullYear(),
            month: today.getMonth(),
            day: today.getDay(),
            hour: today.getHours(),
            minute: today.getMinutes()
        }, () => { // リマインド実行時の処理
            session.send("リマインド：" + message);

        }).on( // リマインドをキャンセルした時の処理
            "canceled", () => {
                session.send("リマインドをキャンセルしました。");
            });
        // リマインドが登録出来たことをidと一緒に通知
        session.send("リマインドを登録しました。(ID：" + reservationId + ")")

    }
});

// 天気取得(現状はイベントがわかりやすいように30秒になるたびにイベントが飛ぶ)
bot.customAction({
    matches: /^weather$/i,
    onSelectAction: (session, args, next) => {
        // 定期処理を実行されているかを判定
        if (session.userData.isRegularly) {
            if (!scheduler.cancelJob("regularly_" + session.userData.id)) {
                session.send("天気予報は開始されていません。")
            }
        } else {
            // 天気予報をスケジュールに登録 イベントIDが被らないように、ユーザーのidを付加する
            var reservation = scheduler.scheduleJob("regularly_" + session.userData.id, {
                // hour: today.getHours(),
                // minute: today.getMinutes(),
                second: 30
            }, () => {
                session.send("今日の天気");
                // apiを呼び出す
                request.get('http://api.openweathermap.org/data/2.5/forecast')
                    .query({
                        id: '6415253',
                        appid: 'afcb81f9414a3f217d66f92f3409e710',
                    }).end((err, res) => {
                        // ユーザーに送る天気情報を作成する
                        var weatherList = createWeatherData(res, 12);
                        for (var i in weatherList) {
                            session.send(weatherList[i].date + "：" + weatherList[i].text);
                        }
                    })
            }).on("canceled", () => {
                // 天気予報を停止した時の処理
                session.userData.isRegularly = false;
                session.send("天気予報を停止しました。");
            });
            // 天気予報を実行していることを記録する
            session.userData.isRegularly = true;
            // 開始をユーザーに伝える
            session.send("天気予報を開始しました。")
        }
    }
});

// リマインドをキャンセルする
bot.customAction({
    matches: /^remind cancel (.+)$/i,
    onSelectAction: (session, args, next) => {
        // イベントIDを取り出す
        var jobId = session.message.text.split(" ")[2];
        // キャンセルする
        if (!scheduler.cancelJob(jobId)) {
            session.send("リマインドのキャンセルに失敗しました。");
            session.send("名前を確認してください");
        }
    }
});
//endregion

// 簡易的にIDを生成する処理
function createPrivateid(n) {
    var CODE_TABLE = "0123456789" +
        "abcdefghijklmnopqrstuvwxyz";
    var r = "";
    for (var i = 0, k = CODE_TABLE.length; i < n; i++) {
        r += CODE_TABLE.charAt(Math.floor(k * Math.random()));
    }
    return r;
}

// apiの結果から天気情報を作成する処理
function createWeatherData(weatherData, hour) {
    const INTERVAL = 3; // APIで取れる間隔が3時間
    var weatherList = JSON.parse(weatherData.text).list;
    var ret = [];

    for (var i = 0; i < hour / INTERVAL; i++) {
        var weather = {};
        weather.text = weatherList[i].weather[0].main;
        weather.date = weatherList[i].dt_txt;
        ret.push(weather);
    }
    return ret;
}
