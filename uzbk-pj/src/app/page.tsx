"use client";

import Link from "next/link";
import { Playfair_Display, Space_Grotesk } from "next/font/google";
import FeedPage from "./(protected)/feed/page";
import { useAuth } from "@/lib/auth-context";
import Loading from "@/components/Loading";

const displayFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const uiFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export default function Page() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (session) return <FeedPage />;

  return (
    <div
      className={`${uiFont.className} relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-x-hidden text-[#1f1b16] -mt-8`}
    >
      <section className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#e6f7df] via-[#f1f7ec] to-[#f6f0e2]">
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 14 }).map((_, index) => (
            <span
              key={`firefly-${index}`}
              className="firefly"
              style={
                {
                  "--x": `${10 + (index * 6) % 80}%`,
                  "--y": `${15 + (index * 9) % 70}%`,
                  "--delay": `${(index % 6) * 0.8}s`,
                  "--size": `${6 + (index % 4) * 2}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <div className="mx-auto flex w-full max-w-none flex-col gap-16 px-6 pb-16 pt-24 sm:px-10 xl:px-16">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f4d2e] text-white shadow-[0_12px_28px_rgba(31,77,46,0.28)]">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M7 14c3-6 7-8 10-8 0 6-4 11-10 11" />
                      <path d="M7 14c0 3 2 4 5 4" />
                    </svg>
                  </span>
                  <div>
                    <div className="text-sm font-semibold tracking-tight text-[#1f4d2e]">
                      Farm Store
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.35em] text-[#5a7c4c]">
                      local & fresh
                    </div>
                  </div>
                </div>
              </div>

              <h1
                className={`${displayFont.className} text-4xl font-semibold leading-tight md:text-5xl`}
              >
                지금 바로 가입하여
                <br />
                오늘 재배한 신선한 작물들을 받아보세요!
              </h1>
              <p className="text-base text-[#4f6a45]">
                동네 인증과 판매자 인증을 거친 농장 상품을 한눈에 모아
                보여줍니다. 근처 농장의 실시간 위치와 함께 빠르게 거래하세요.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/auth"
                  className="rounded-full bg-[#234d32] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(35,77,50,0.3)]"
                >
                  시작하기
                </Link>
                <Link
                  href="/auth"
                  className="rounded-full border border-[#234d32]/30 bg-white/70 px-5 py-2.5 text-sm font-semibold text-[#234d32]"
                >
                  로그인
                </Link>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-[#234d32]/10 bg-white/80 p-6 shadow-[0_24px_60px_rgba(35,77,50,0.12)]">
              <div className="absolute -right-24 -top-20 h-48 w-48 rounded-full bg-[#dff4d0]" />
              <div className="absolute -bottom-24 -left-12 h-40 w-40 rounded-full bg-[#f7f0d6]" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between text-xs text-[#5a7c4c]">
                  <span>오늘의 동네 농장</span>
                  <span>25km 반경</span>
                </div>
                <div className="h-48 rounded-2xl border border-[#234d32]/10 bg-gradient-to-br from-[#e2f6d8] to-[#f2f8eb] p-4">
                  <div className="text-sm font-semibold">지도 미리보기</div>
                  <div className="mt-8 h-24 rounded-xl bg-white/70" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    "판매자 인증 완료",
                    "동네 기반 추천",
                    "실시간 채팅",
                    "거래 상태 관리",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-[#234d32]/10 bg-white px-4 py-3 text-sm font-semibold"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/80">
        <div className="mx-auto w-full max-w-none px-6 py-16 sm:px-10 xl:px-16">
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                title: "동네 인증",
                body: "주소 기반 인증으로 내 근처 농장만 바로 확인.",
              },
              {
                title: "판매자 검증",
                body: "판매자 인증을 통과한 농장만 등록.",
              },
              {
                title: "안전한 거래",
                body: "실시간 채팅과 상태 관리로 안전하게 거래.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-3xl border border-[#234d32]/10 bg-white/90 p-6 shadow-[0_16px_40px_rgba(35,77,50,0.08)]"
              >
                <div className="text-xs uppercase tracking-[0.3em] text-[#5a7c4c]">
                  feature
                </div>
                <h3 className="mt-3 text-lg font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm text-[#4f6a45]">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f1f7ec]">
        <div className="mx-auto w-full max-w-none px-6 py-16 sm:px-10 xl:px-16">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[28px] border border-[#234d32]/10 bg-white/85 p-8">
              <h2 className={`${displayFont.className} text-2xl`}>
                오늘의 동네 추천
              </h2>
              <p className="mt-3 text-sm text-[#4f6a45]">
                동네 기반으로 추천되는 농장 상품을 빠르게 확인하세요.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {["감자", "토마토", "오이", "딸기"].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[#234d32]/10 bg-white px-4 py-3 text-sm font-semibold"
                  >
                    {item} · 신선 수확
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[28px] border border-[#234d32]/10 bg-white/85 p-8">
              <h2 className={`${displayFont.className} text-2xl`}>
                이용 흐름
              </h2>
              <ol className="mt-5 space-y-4 text-sm text-[#4f6a45]">
                <li>1. 회원가입 및 동네 인증</li>
                <li>2. 농장 상품 탐색</li>
                <li>3. 실시간 채팅으로 거래</li>
                <li>4. 거래 완료 & 리뷰</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/90">
        <div className="mx-auto w-full max-w-none px-6 py-16 sm:px-10 xl:px-16">
          <div className="rounded-[28px] border border-[#234d32]/10 bg-white/90 p-10 text-center">
            <h2 className={`${displayFont.className} text-2xl`}>
              동네 농장을 지금 바로 만나보세요
            </h2>
            <p className="mt-3 text-sm text-[#4f6a45]">
              지금 바로 가입하여 오늘 재배한 신선한 작물들을 받아보세요!
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/auth"
                className="rounded-full bg-[#234d32] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(35,77,50,0.3)]"
              >
                무료로 시작하기
              </Link>
              <Link
                href="/auth"
                className="rounded-full border border-[#234d32]/30 bg-white/70 px-5 py-2.5 text-sm font-semibold text-[#234d32]"
              >
                로그인
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#234d32]/15 bg-[#f7f6f2] text-sm text-[#4f6a45]">
        <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-6 py-10 sm:px-10 xl:px-16 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="font-semibold text-[#234d32]">Farm Store</div>
            <div>운영: Uzbekis Farm</div>
            <div>연락처: 000-0000-0000</div>
            <div>이메일: help@uzbekisfarm.com</div>
            <div>주소: Tashkent, Uzbekistan</div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-[#234d32]">Customer</div>
            <div>공지사항</div>
            <div>이용약관</div>
            <div>개인정보 처리방침</div>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .firefly {
          position: absolute;
          left: var(--x);
          top: var(--y);
          width: var(--size);
          height: var(--size);
          border-radius: 999px;
          background: radial-gradient(
            circle,
            rgba(255, 244, 175, 0.9) 0%,
            rgba(255, 244, 175, 0.35) 60%,
            transparent 100%
          );
          box-shadow: 0 0 18px rgba(255, 244, 175, 0.6);
          animation: float 6s ease-in-out infinite;
          animation-delay: var(--delay);
          opacity: 0.8;
        }

        @keyframes float {
          0% {
            transform: translate3d(0, 0, 0);
            opacity: 0.6;
          }
          50% {
            transform: translate3d(12px, -18px, 0);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}
