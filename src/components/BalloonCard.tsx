import React from "react";
import "./BalloonCard.css";

interface BalloonCardProps {
  id: string;
  lat: number;
  lon: number;
  alt: number;
  temperature?: number;
  windspeed?: number;
}

const BalloonCard: React.FC<BalloonCardProps> = ({
  id,
  lat,
  lon,
  alt,
  temperature,
  windspeed,
}) => {
  return (
    <article className="balloon-card" aria-labelledby={`balloon-${id}`}>
      <h3 id={`balloon-${id}`} title={String(id)}>
        Balloon {id || "Unknown"}
      </h3>

      <div className="meta">
        <p className="coords" title={`Lat: ${lat}, Lon: ${lon}`}>
          Lat: {lat.toFixed(2)}°, Lon: {lon.toFixed(2)}°
        </p>
        <p>Alt: {alt?.toFixed(0)} m</p>
      </div>

      {temperature !== undefined && windspeed !== undefined ? (
        <div className="meta">
          <p className="stat">🌡 {temperature}°C</p>
          <p className="stat">💨 {windspeed} km/h</p>
        </div>
      ) : (
        <p>No weather data available</p>
      )}
    </article>
  );
};

export default BalloonCard;
