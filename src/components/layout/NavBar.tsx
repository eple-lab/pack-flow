'use client';
/**
 * 상단 내비 — 대시보드 · 입출고 · 이력 · 품목 링크. 지금 경로의 링크를 강조한다.
 *
 * 하는 일: 경로가 같거나 그 아래(예 /trades/x)면 활성으로 표시(aria-current="page"). 휴대폰 폭에서는 가로 스크롤(CSS).
 *
 * 근거: docs/wireframes.html 2절, WU-05 1번
 * 구역: eple (docs/06-work-plan.md 1절 '앱 뼈대')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 내비 (WU-05)
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './layout.module.css';

/** 내비 항목: 글자 · 경로 · testid. */
export const NAV_ITEMS = [
  { label: '대시보드', href: '/', testid: 'nav-dashboard' },
  { label: '입출고', href: '/trades', testid: 'nav-trades' },
  { label: '이력', href: '/history', testid: 'nav-history' },
  { label: '품목', href: '/items', testid: 'nav-items' },
] as const;

/** 경로가 항목과 같거나 그 아래인가(홈 `/`는 정확히 `/`만). */
export function isActivePath(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** 내비. testid: nav-dashboard · nav-trades · nav-history · nav-items */
export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="주 메뉴">
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
            aria-current={active ? 'page' : undefined}
            data-testid={item.testid}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
