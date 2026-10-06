"use client";

import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { formatChips } from "../../shared/slots";
import { CASINO_URL } from "@/lib/auth";
import { useAuth } from "./AuthProvider";
import { useWallet } from "./WalletProvider";
import { ChipIcon } from "./ChipIcon";

export function TopBar({ children }: { children?: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { balance } = useWallet();

  return (
    <header className="topbar">
      <a href={CASINO_URL} className="back" aria-label="Back to Planary Casino">
        <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
      </a>
      <Link href="/" className="brand" aria-label="The slot parlour">
        <ChipIcon size={34} letter="S" />
        <span className="brand-copy">
          <span className="brand-name poster">Slots</span>
          <span className="brand-sub">Planary Casino</span>
        </span>
      </Link>

      <div className="topbar-middle">{children}</div>

      <div className="topbar-actions">
        {balance !== null ? (
          <span className="balance" title="Play money, shared across Planary Casino">
            <ChipIcon size={20} />
            <strong className="num">{formatChips(balance)}</strong>
            <span className="balance-label">chips</span>
          </span>
        ) : (
          <span className="skeleton" aria-hidden="true" />
        )}
        <span className="who-chip" title={user.email}>
          {user.name}
        </span>
        <button className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out">
          <LogOut size={18} strokeWidth={1.9} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
