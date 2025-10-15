import React from "react";
import "./LoadingModal.css";

interface LoadingModalProps {
  isVisible: boolean;
  title?: string;
  subtitle?: string;
}

export default function LoadingModal({
  isVisible,
  title = "Loading balloons...",
  subtitle = "I'm using a free‑tier Render deployment — please be patient :)",
}: LoadingModalProps) {
  if (!isVisible) return null;
  return (
    <div className="loading-modal-overlay">
      <div className="loading-modal">
        <div className="loading-spinner">
          <div className="spinner-ring" />
        </div>
        <div className="loading-title">{title}</div>
        <div className="loading-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}
