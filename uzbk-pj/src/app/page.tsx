import { Playfair_Display, Space_Grotesk } from "next/font/google";

const displayFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const uiFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const CATEGORIES = [
  "스마트팜",
  "채소",
  "과일",
  "곡물",
  "가공품",
  "체험",
  "기타",
];

const SAMPLE_ITEMS = [
  {
    title: "토마토 프리미엄 박스",
    price: "25,000원",
    location: "서울 · 채소",
  },
  {
    title: "샤인머스켓 2kg",
    price: "39,000원",
    location: "경기 · 과일",
  },
  {
    title: "무농약 감자 5kg",
    price: "18,000원",
    location: "강원 · 채소",
  },
  {
    title: "현미 10kg",
    price: "32,000원",
    location: "전북 · 곡물",
  },
  {
    title: "딸기잼 세트",
    price: "14,000원",
    location: "충남 · 가공품",
  },
  {
    title: "주말 농장 체험권",
    price: "20,000원",
    location: "충북 · 체험",
  },
];

export default function Page() {
  return (
    <div
      className={`${uiFont.className} min-h-screen`}
      style={
        {
          "--page-bg": "#f7f2e8",
          "--ink": "#1c1a17",
          "--accent": "#1b6d3a",
          "--muted": "#8b8073",
        } as React.CSSProperties
      }
    >
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <section className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">
                seasonal market
              </div>
              <h1
                className={`${displayFont.className} text-4xl font-semibold text-[var(--ink)] md:text-5xl`}
              >
                FARM STORE
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-[var(--ink)]" />
              <div className="text-sm text-[var(--muted)]">
                오늘의 추천 농장 상품
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                className="rounded-full border border-[var(--ink)]/15 bg-white px-4 py-2 text-sm text-[var(--ink)] shadow-sm hover:border-[var(--ink)]/40"
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_ITEMS.map((item, index) => (
              <article
                key={item.title}
                className="group rounded-3xl border border-[var(--ink)]/10 bg-white p-4 shadow-[0_10px_30px_rgba(28,26,23,0.08)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(28,26,23,0.12)]"
              >
                <div
                  className="h-44 rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, rgba(27,109,58,0.${
                      3 + (index % 3) * 2
                    }) 0%, rgba(247,242,232,0.9) 65%)`,
                  }}
                />
                <div className="mt-4 space-y-2">
                  <h3 className="text-base font-semibold text-[var(--ink)]">
                    {item.title}
                  </h3>
                  <div className="text-lg font-semibold text-[var(--ink)]">
                    {item.price}
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {item.location}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="rounded-[32px] border border-[var(--ink)]/20 bg-[#e5f1fb] px-8 py-10 text-center">
            <div
              className={`${displayFont.className} text-2xl text-[var(--ink)]`}
            >
              For the customer
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              주변 농장의 신선한 상품을 빠르게 찾아보세요.
            </p>
          </div>
          <div className="rounded-[32px] border border-[var(--ink)]/20 bg-[#e4f7dc] px-8 py-10 text-center">
            <div
              className={`${displayFont.className} text-2xl text-[var(--ink)]`}
            >
              For the farmer
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              내 농장 상품을 간편하게 등록하고 판매할 수 있어요.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
