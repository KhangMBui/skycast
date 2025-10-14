import React from "react";
import BalloonCard from "./BalloonCard";
import "./BalloonList.css";

interface Balloon {
  id: string;
  lat: number;
  lon: number;
  alt: number;
  weather?: {
    temperature: number;
    windspeed: number;
  };
}

interface BalloonListProps {
  balloons: Balloon[];
}

const BalloonList: React.FC<BalloonListProps> = ({ balloons }) => {
  if (balloons.length === 0) {
    return <p className="no-data">No balloon data available.</p>;
  }

  return (
    <div className="balloon-list">
      {balloons.map((b) => (
        <BalloonCard
          key={b.id}
          id={b.id}
          lat={b.lat}
          lon={b.lon}
          alt={b.alt}
          temperature={b.weather?.temperature}
          windspeed={b.weather?.windspeed}
        />
      ))}
    </div>
  );
};

export default BalloonList;
