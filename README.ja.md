# Homebridge Nature Remo Multi Platform

日本語 | [English](README.md)

複数のNature RemoをHomebridge／Apple HomeKitへ追加するための、非公式の独立プラグインです。

Natureアカウントに登録されているRemo、センサー、照明、エアコン、テレビを自動検出し、設定画面から公開対象を選択できます。

このプラグインはNature株式会社とは関係ありません。

## 主な機能

- 同一アカウントに登録された複数のNature Remoを自動検出
- Alexa Smart Home Plusに近い日本語／英語対応の設定UI
- 使用するNature Remoを個別選択
- 制御する家電、または制御しない家電を個別選択
- Remoを無効化した場合、そのRemoのセンサーと所属家電も自動的に無効化
- 温度、湿度、照度、人感センサー
- 照明のオン／オフ
- エアコンの電源、暖房／冷房、設定温度
- テレビの電源、ミュート、音量、リモコン操作
- Homebridgeキャッシュの更新と不要アクセサリの自動削除
- Nature APIのタイムアウト、レート制限、認証エラー処理

## 動作環境

- Homebridge 2.x
- Node.js 22.13以降、またはNode.js 24.x
- Nature Cloud APIアクセストークン

アクセストークンは[Nature Developer Page](https://home.nature.global/)で発行できます。

## インストール

Homebridge UIのプラグイン画面で、次のパッケージを検索してインストールします。

```text
homebridge-nature-remo-multi-platform
```

ターミナルからインストールする場合：

```sh
npm install -g homebridge-nature-remo-multi-platform
```

バージョン2.0はHomebridge 2.xのESM読み込み方式を使用します。Homebridge 1.xでは1.4系を使用してください。

## 設定方法

1. Homebridge UIでプラグイン設定を開きます。
2. Nature Cloud APIアクセストークンを入力します。
3. 「接続して機器を取得」を押します。
4. 使用するNature Remoを選択します。
5. 公開する温度、湿度、照度、人感センサーを選択します。
6. 「制御する機器」または「制御しない機器」を選びます。
7. 設定を保存してHomebridgeを再起動します。

手動設定の例：

```json
{
  "platform": "NatureRemoMultiPlatform",
  "name": "Nature Remo Multi",
  "accessToken": "NATURE_API_ACCESS_TOKEN",
  "LIGHT": true,
  "AC": true,
  "TV": true,
  "sensorPollingSeconds": 30,
  "motionHoldSeconds": 60
}
```

## センサー

以下はHomeKit標準センサーとして公開されます。

- 温度
- 湿度
- 照度
- 人感

センサー更新間隔は15～300秒、人感検知の保持時間は15～600秒で設定できます。

Nature APIが一時的な異常値を返した場合は、HomeKitへ不正な値を送信しません。照度0はHomeKit仕様に合わせて最小値へ補正します。

## エアコン

現在HomeKitへ公開する運転モードは暖房と冷房です。停止中にNature APIが設定温度0を返した場合は、最後の有効値または24℃を使用します。

## 注意事項

- 旧`NatureRemoPlatformPlugin`と同じ家電を同時に登録しないでください。
- 赤外線家電は外部リモコン操作の状態を完全には取得できません。
- テレビの電源状態など、Nature APIから取得できない状態はプラグイン内で推定します。
- アクセストークンをログやIssueへ貼り付けないでください。

## ライセンス

Apache-2.0。

このプロジェクトはApache-2.0で公開された`homebridge-nature-remo-platform`を基にしており、元のライセンスと著作権表示を維持しています。
