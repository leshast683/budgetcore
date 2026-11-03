// Shared avatar utilities
import { supabase } from './supabase.js';

// The 5 default avatar images (matching profile.html)
export const AVATAR_IMAGES = {
  '1': 'avatar-bear.jpg',
  '2': 'avatar-fox.jpg',
  '3': 'avatar-raccoon.jpg',
  '4': 'avatar-owl.jpg',
  '5': 'avatar-sloth.jpg',
};

// Apply avatar to a ring element
export function applyAvatarToRing(ringEl, profileData) {
  if (!ringEl || !profileData) return;
  if (profileData.avatar_data) {
    ringEl.innerHTML = `<img src="${profileData.avatar_data}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
  } else if (profileData.avatar && AVATAR_IMAGES[String(profileData.avatar)]) {
    ringEl.innerHTML = `<img src="${AVATAR_IMAGES[String(profileData.avatar)]}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
  }
}

// Load profile and apply avatar to a ring element by ID
export async function loadAndApplyAvatar(uid, ringElId) {
  try {
    const { data } = await supabase.from('profiles').select('avatar, avatar_data').eq('id', uid).single();
    if (data) {
      const ringEl = document.getElementById(ringElId);
      applyAvatarToRing(ringEl, data);
    }
  } catch (e) { /* silently ignore */ }
}
