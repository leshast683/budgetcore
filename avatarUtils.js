// Shared avatar utilities
import { auth, db } from './firebase.js';
import { getDoc, doc } from 'firebase/firestore';

// The 10 default avatar SVGs (matching profile.html)
export const AVATAR_SVGS = {
  '1': `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#fde8cc"/><path d="M20 10 L24 18 L32 19 L26 25 L28 33 L20 29 L12 33 L14 25 L8 19 L16 18 Z" fill="#f5a623" stroke="none"/></svg>`,
  '2': `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#d4ecd4"/><circle cx="14" cy="12" r="5" fill="#5c8a5c"/><circle cx="26" cy="12" r="5" fill="#5c8a5c"/><circle cx="20" cy="22" r="10" fill="#5c8a5c"/><circle cx="20" cy="24" r="4" fill="#8ac48a"/><circle cx="17" cy="19" r="2" fill="white"/><circle cx="23" cy="19" r="2" fill="white"/><circle cx="17" cy="19" r="1" fill="#1a0e06"/><circle cx="23" cy="19" r="1" fill="#1a0e06"/></svg>`,
  '3': `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#e8d4f0"/><ellipse cx="20" cy="22" rx="11" ry="12" fill="#9060b0"/><circle cx="15" cy="18" r="5" fill="white"/><circle cx="25" cy="18" r="5" fill="white"/><circle cx="15" cy="18" r="3" fill="#1a0e06"/><circle cx="25" cy="18" r="3" fill="#1a0e06"/><path d="M17 26 Q20 29 23 26" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 11 L20 15 L24 11" stroke="#9060b0" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  '4': `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#ffe0cc"/><path d="M8 10 L16 18 L12 10 Z" fill="#e07030"/><path d="M32 10 L24 18 L28 10 Z" fill="#e07030"/><circle cx="20" cy="22" r="10" fill="#e07030"/><circle cx="20" cy="24" r="5" fill="#ffd0b0"/><circle cx="16" cy="19" r="2" fill="white"/><circle cx="24" cy="19" r="2" fill="white"/><circle cx="16" cy="19" r="1" fill="#1a0e06"/><circle cx="24" cy="19" r="1" fill="#1a0e06"/></svg>`,
  '5': `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#fff0cc"/><circle cx="20" cy="20" r="13" fill="#d4a020" opacity="0.4"/><circle cx="20" cy="21" r="9" fill="#e8a030"/><circle cx="16" cy="18" r="2" fill="white"/><circle cx="24" cy="18" r="2" fill="white"/><circle cx="16" cy="18" r="1" fill="#1a0e06"/><circle cx="24" cy="18" r="1" fill="#1a0e06"/><path d="M17 24 Q20 27 23 24" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
  '6': `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#f0e4ff"/><ellipse cx="14" cy="9" rx="3.5" ry="7" fill="#c89ae0"/><ellipse cx="26" cy="9" rx="3.5" ry="7" fill="#c89ae0"/><ellipse cx="14" cy="9" rx="2" ry="5" fill="#f8d0e8"/><ellipse cx="26" cy="9" rx="2" ry="5" fill="#f8d0e8"/><circle cx="20" cy="22" r="10" fill="#e0c8f8"/><circle cx="15.5" cy="19" r="2.5" fill="white"/><circle cx="24.5" cy="19" r="2.5" fill="white"/><circle cx="15.5" cy="19" r="1.2" fill="#1a0e06"/><circle cx="24.5" cy="19" r="1.2" fill="#1a0e06"/><ellipse cx="20" cy="23" rx="2" ry="1.5" fill="#f8a0c0"/></svg>`,
  '7': `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#ccf0e8"/><path d="M13 14 L16 7 L18.5 14Z" fill="#20a080"/><path d="M20 12 L22 6 L24 12Z" fill="#20a080"/><path d="M25 14 L27.5 7 L30 14Z" fill="#20a080"/><circle cx="20" cy="23" r="11" fill="#30c090"/><ellipse cx="15" cy="20" rx="3" ry="3.5" fill="white"/><ellipse cx="25" cy="20" rx="3" ry="3.5" fill="white"/><ellipse cx="15" cy="20" rx="1.5" ry="2" fill="#1a0e06"/><ellipse cx="25" cy="20" rx="1.5" ry="2" fill="#1a0e06"/><path d="M15 27 Q20 31 25 27" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
  '8': `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#f0f0f0"/><circle cx="12" cy="11" r="6" fill="#222"/><circle cx="28" cy="11" r="6" fill="#222"/><circle cx="20" cy="22" r="11" fill="white"/><ellipse cx="15" cy="19" rx="4" ry="4" fill="#222"/><ellipse cx="25" cy="19" rx="4" ry="4" fill="#222"/><circle cx="15" cy="19" r="2" fill="white"/><circle cx="25" cy="19" r="2" fill="white"/><circle cx="15" cy="19" r="1" fill="#1a0e06"/><circle cx="25" cy="19" r="1" fill="#1a0e06"/><ellipse cx="20" cy="24" rx="2.5" ry="1.5" fill="#333"/><path d="M17 26 Q20 29 23 26" stroke="#333" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
  '9': `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#d4eef8"/><path d="M10 14 L14 6 L18 14Z" fill="#5a90b8"/><path d="M22 14 L26 6 L30 14Z" fill="#5a90b8"/><path d="M11.5 14 L14 8 L16.5 14Z" fill="#f0c0d0"/><path d="M23.5 14 L26 8 L28.5 14Z" fill="#f0c0d0"/><circle cx="20" cy="22" r="10" fill="#6aa8c8"/><ellipse cx="15.5" cy="19" rx="2.5" ry="3" fill="white"/><ellipse cx="24.5" cy="19" rx="2.5" ry="3" fill="white"/><ellipse cx="15.5" cy="19" rx="1" ry="2" fill="#1a0e06"/><ellipse cx="24.5" cy="19" rx="1" ry="2" fill="#1a0e06"/><ellipse cx="20" cy="23" rx="1.5" ry="1" fill="#f0a0b0"/><path d="M13 22 L17 23M13 24 L17 24" stroke="white" stroke-width="0.8" stroke-linecap="round"/><path d="M27 22 L23 23M27 24 L23 24" stroke="white" stroke-width="0.8" stroke-linecap="round"/></svg>`,
  '10': `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#ccd8e8"/><ellipse cx="20" cy="24" rx="11" ry="12" fill="#1a2840"/><ellipse cx="20" cy="26" rx="6" ry="8" fill="white"/><circle cx="15" cy="17" r="3" fill="white"/><circle cx="25" cy="17" r="3" fill="white"/><circle cx="15" cy="17" r="1.5" fill="#1a0e06"/><circle cx="25" cy="17" r="1.5" fill="#1a0e06"/><path d="M17 22 L20 25 L23 22Z" fill="#f0a020"/></svg>`,
};

// Apply avatar to a ring element
export function applyAvatarToRing(ringEl, profileData) {
  if (!ringEl || !profileData) return;
  if (profileData.avatarData) {
    ringEl.innerHTML = `<img src="${profileData.avatarData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
  } else if (profileData.avatar && AVATAR_SVGS[String(profileData.avatar)]) {
    ringEl.innerHTML = AVATAR_SVGS[String(profileData.avatar)];
    const svg = ringEl.querySelector('svg');
    if (svg) { svg.style.width = '100%'; svg.style.height = '100%'; }
  }
}

// Load profile and apply avatar to a ring element by ID
export async function loadAndApplyAvatar(uid, ringElId) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'userProfile'));
    if (snap.exists()) {
      const ringEl = document.getElementById(ringElId);
      applyAvatarToRing(ringEl, snap.data());
    }
  } catch (e) { /* silently ignore */ }
}
