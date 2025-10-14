import React, { useMemo, useState } from "react";
// import BalloonCard from "./BalloonCard";
import "./BalloonList.css";
import BalloonCard from "./BalloonCard";

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
  pageSize?: number;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}

const BalloonList: React.FC<BalloonListProps> = ({
  balloons,
  pageSize = 30,
  onSelect,
  selectedId,
}) => {
  const [page, setPage] = useState(0);
  const total = Math.ceil(balloons.length / pageSize);
  const pageItems = useMemo(
    () => balloons.slice(page * pageSize, (page + 1) * pageSize),
    [balloons, page, pageSize]
  );

  if (balloons.length === 0) return <p>No balloon data</p>;

  return (
    <div>
      <div className="balloon-list">
        {pageItems.map((b) => (
          <div
            key={b.id}
            className={`balloon-card-wrapper ${
              selectedId === b.id ? "selected" : ""
            }`}
            onClick={() => onSelect?.(b.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect?.(b.id);
            }}
          >
            <BalloonCard
              id={b.id}
              lat={b.lat}
              lon={b.lon}
              alt={b.alt}
              temperature={b.weather?.temperature}
              windspeed={b.weather?.windspeed}
            />
          </div>
        ))}
      </div>

      <div className="pagination">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          Prev
        </button>
        <span>
          Page {page + 1}/{total}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(total - 1, p + 1))}
          disabled={page >= total - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
};
export default BalloonList;
