export interface GameCardProps {
  title: string;
  /** Small line above the title, e.g. the on-chain `vote` value. */
  eyebrow: string;
  cover: string;
  /** 0 = GTA 6, 1 = Zelda — the value sent to the contract. */
  vote: 0 | 1;
  /** Current count from `get_tally`, or `undefined` while loading. */
  tally: number | undefined;
  disabled: boolean;
  busy: boolean;
  onVote: (vote: 0 | 1) => void;
}

export function GameCard({
  title,
  eyebrow,
  cover,
  vote,
  tally,
  disabled,
  busy,
  onVote,
}: GameCardProps) {
  return (
    <article className={`game-card${busy ? " game-card--busy" : ""}`}>
      <div className="game-card__media">
        <img src={cover} alt={`${title} cover art`} loading="lazy" />
      </div>
      <div className="game-card__body">
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="game-card__title">{title}</h3>
        <p className="game-card__tally">
          <strong>{tally ?? "—"}</strong>
          <span>{tally === 1 ? "vote" : "votes"}</span>
        </p>
        <button
          className="game-card__vote"
          type="button"
          onClick={() => onVote(vote)}
          disabled={disabled}
        >
          {busy ? "Voting…" : `Vote for ${title}`}
        </button>
      </div>
    </article>
  );
}
