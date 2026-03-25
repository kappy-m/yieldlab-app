"""
Review / Inquiry シードデータ投入スクリプト
実行: cd /volume1/docker/yieldlab-app && python3 -m backend.seed_reviews
"""
import asyncio
import datetime
import json
from backend.database import AsyncSessionLocal, init_db
from backend.models.review_entry import ReviewEntry, ReviewPlatform, ReviewLanguage
from backend.models.inquiry_entry import InquiryEntry, InquiryChannel, InquiryStatus, InquiryPriority
from backend.models.property import Property
from sqlalchemy import select

REVIEWS = [
    dict(platform=ReviewPlatform.google,  author="田中　恵",    rating=5.0, language=ReviewLanguage.ja, review_date=datetime.date(2026,3,22), responded=False,
         text="スタッフの皆さんがとても親切で、チェックインからチェックアウトまで快適に過ごせました。部屋も清潔で、眺めが素晴らしかったです。また訪れたいと思います。"),
    dict(platform=ReviewPlatform.rakuten, author="山本　隆",    rating=4.0, language=ReviewLanguage.ja, review_date=datetime.date(2026,3,20), responded=True,
         text="立地が最高で、交通アクセスが便利でした。朝食のビュッフェが充実していて満足しています。ただ、部屋がやや狭く感じました。",
         response="山本様、ご宿泊いただきありがとうございます。お部屋の広さについてのご意見、真摯に受け止めます。またのご来館を心よりお待ちしております。"),
    dict(platform=ReviewPlatform.expedia, author="John Miller", rating=4.0, language=ReviewLanguage.en, review_date=datetime.date(2026,3,19), responded=False,
         text="Excellent location near the train station. Staff was very friendly and helpful. The room was a bit small but clean and well-maintained. Breakfast had great variety."),
    dict(platform=ReviewPlatform.google,  author="李 明",       rating=3.0, language=ReviewLanguage.zh, review_date=datetime.date(2026,3,17), responded=False,
         text="位置很好，靠近地铁站，交通方便。但是房间比较小，隔音效果不太好。早餐选择不多。服务人员态度友善。"),
    dict(platform=ReviewPlatform.rakuten, author="佐藤　美幸",  rating=5.0, language=ReviewLanguage.ja, review_date=datetime.date(2026,3,15), responded=True,
         text="記念日に利用させていただきました。スタッフの方がサプライズを用意してくださり、感動しました！部屋も広く、アメニティも充実していました。",
         response="佐藤様、記念日のご宿泊に選んでいただき、誠にありがとうございました。またのご来館をお待ちしております。"),
    dict(platform=ReviewPlatform.booking, author="김민준",      rating=4.0, language=ReviewLanguage.ko, review_date=datetime.date(2026,3,14), responded=False,
         text="위치가 매우 좋고 직원들이 친절했습니다. 객실은 깨끗하고 편안했습니다. 아침 식사 메뉴가 더 다양하면 좋겠습니다."),
    dict(platform=ReviewPlatform.google,  author="鈴木　一郎",  rating=2.0, language=ReviewLanguage.ja, review_date=datetime.date(2026,3,12), responded=True,
         text="チェックイン時の待ち時間が長く、案内も不十分でした。部屋の清掃が行き届いておらず、浴室に汚れが残っていました。改善を望みます。",
         response="鈴木様、ご不便をおかけして誠に申し訳ございません。いただいたご指摘を真摯に受け止め、清掃体制の強化に努めてまいります。"),
    dict(platform=ReviewPlatform.expedia, author="Sarah Chen",  rating=5.0, language=ReviewLanguage.en, review_date=datetime.date(2026,3,10), responded=False,
         text="Absolutely wonderful stay! The concierge helped us plan our entire Tokyo itinerary. Room had a stunning view of the city. Will definitely be back on our next Japan trip."),
    dict(platform=ReviewPlatform.rakuten, author="中村　健太",  rating=4.0, language=ReviewLanguage.ja, review_date=datetime.date(2026,3,8), responded=False,
         text="ビジネス出張で利用。Wi-Fiが安定していて、デスクスペースも十分ありました。朝食付きプランが便利でした。次回もリピートします。"),
    dict(platform=ReviewPlatform.google,  author="王 建国",     rating=3.0, language=ReviewLanguage.zh, review_date=datetime.date(2026,3,6), responded=False,
         text="酒店位置不错，附近有很多餐厅和购物中心。房间设施老旧，需要更新。工作人员虽然友好，但英语沟通有些困难。"),
    dict(platform=ReviewPlatform.booking, author="Thomas Weber", rating=4.0, language=ReviewLanguage.de, review_date=datetime.date(2026,3,5), responded=False,
         text="Gutes Hotel in zentraler Lage. Das Personal war freundlich und hilfsbereit. Das Frühstücksbuffet war reichhaltig. Das Zimmer war sauber, aber etwas klein."),
    dict(platform=ReviewPlatform.rakuten, author="高橋　由美",  rating=5.0, language=ReviewLanguage.ja, review_date=datetime.date(2026,3,3), responded=False,
         text="家族旅行で利用しました。子どもへのサービスが充実していて、子連れでも快適に過ごせました。大浴場も良かったです。"),
    dict(platform=ReviewPlatform.expedia, author="Maria Garcia", rating=3.0, language=ReviewLanguage.en, review_date=datetime.date(2026,3,1), responded=False,
         text="The hotel is in a good location but the rooms need renovation. The staff was helpful. The breakfast was disappointing with limited options. Price is a bit high for what you get."),
    dict(platform=ReviewPlatform.google,  author="伊藤　朋子",  rating=5.0, language=ReviewLanguage.ja, review_date=datetime.date(2026,2,28), responded=False,
         text="温泉とサウナが最高でした。夕食のコース料理も美味しく、全体的に大満足です。スタッフの気配りが随所に感じられ、また来たいと思いました。"),
    dict(platform=ReviewPlatform.booking, author="陈小燕",      rating=4.0, language=ReviewLanguage.zh, review_date=datetime.date(2026,2,25), responded=False,
         text="酒店整体感觉不错，地理位置优越。前台服务很周到，能说简单中文。房间干净整洁，设施齐全。早餐种类丰富，性价比高。"),
]

INQUIRIES = [
    dict(channel=InquiryChannel.email, customer_name="田中　浩二", customer_email="koji.tanaka@example.com",
         subject="チェックイン時間の変更について", language="ja", status=InquiryStatus.new, priority=InquiryPriority.medium,
         inquiry_date=datetime.date(2026,3,24), tags=json.dumps(["チェックイン","時間変更"]),
         content="お世話になっております。3月28日に2名で予約をしております田中と申します。\n\n通常のチェックイン時間は15時とのことですが、当日の会議が長引く可能性があり、18時頃にチェックインになってしまう可能性があります。\n\n遅れた場合でも問題なくチェックインできますでしょうか？また、追加料金が発生する場合は教えていただけますか？"),
    dict(channel=InquiryChannel.form, customer_name="山田　花子", customer_email="hanako.yamada@example.jp",
         subject="記念日プランについてのご相談", language="ja", status=InquiryStatus.in_progress, priority=InquiryPriority.high,
         inquiry_date=datetime.date(2026,3,23), assignee="佐藤（フロント）", tags=json.dumps(["記念日","特別アレンジ"]),
         content="来月の結婚記念日に夫婦で宿泊を予定しています。特別なアレンジ（ケーキの手配、フラワーデコレーション等）をお願いすることはできますか？\n\nご予算は1万円程度で考えていますが、どのようなオプションがありますか？詳細をお知らせいただけると幸いです。"),
    dict(channel=InquiryChannel.email, customer_name="James Wilson", customer_email="j.wilson@company.com",
         subject="Corporate account inquiry", language="en", status=InquiryStatus.new, priority=InquiryPriority.high,
         inquiry_date=datetime.date(2026,3,23), tags=json.dumps(["法人", "コーポレート"]),
         content="Hello,\n\nI am the travel manager for Wilson & Associates (50 employees). We are looking for a preferred hotel partner for our frequent business trips to Tokyo.\n\nCould you please provide information about your corporate rates and any loyalty benefits for business accounts?\n\nWe typically need 5-10 room nights per month. Please let me know your available packages."),
    dict(channel=InquiryChannel.phone, customer_name="鈴木　太郎", customer_phone="090-1234-5678",
         subject="お荷物の預かりについて", language="ja", status=InquiryStatus.resolved, priority=InquiryPriority.low,
         inquiry_date=datetime.date(2026,3,22), tags=json.dumps(["手荷物","預かり"]),
         response="チェックイン前後のお荷物お預かりは無料でご対応しております。フロントにてお申し付けください。",
         content="明日チェックアウト予定ですが、チェックアウト後も荷物を預かっていただけますか？観光して夕方の新幹線で帰る予定です。"),
    dict(channel=InquiryChannel.email, customer_name="佐々木　理恵", customer_email="rie.sasaki@mail.com",
         subject="駐車場のご案内について", language="ja", status=InquiryStatus.new, priority=InquiryPriority.low,
         inquiry_date=datetime.date(2026,3,21), tags=json.dumps(["駐車場"]),
         content="来週末に宿泊を予定しています。お車で伺う予定なのですが、ホテルに駐車場はございますか？\n\n料金と収容台数を教えていただけますか？また、事前予約が必要かどうかも確認させてください。"),
]


async def seed_reviews():
    await init_db()
    async with AsyncSessionLocal() as session:
        # 最初のプロパティを取得
        result = await session.execute(select(Property).limit(1))
        prop = result.scalar_one_or_none()
        if not prop:
            print("❌ No property found. Run seed.py first.")
            return

        # 既存データチェック
        from sqlalchemy import func
        count_r = await session.execute(
            select(func.count()).select_from(ReviewEntry).filter(ReviewEntry.property_id == prop.id)
        )
        if count_r.scalar() > 0:
            print(f"✓ Review entries already seeded for property_id={prop.id}. Skipping.")
            return

        # ReviewEntry 投入
        for r in REVIEWS:
            entry = ReviewEntry(property_id=prop.id, **r)
            session.add(entry)

        # InquiryEntry 投入
        for q in INQUIRIES:
            entry = InquiryEntry(property_id=prop.id, **q)
            session.add(entry)

        await session.commit()
        print(f"✓ Seeded {len(REVIEWS)} reviews + {len(INQUIRIES)} inquiries for property_id={prop.id}")


if __name__ == "__main__":
    asyncio.run(seed_reviews())
