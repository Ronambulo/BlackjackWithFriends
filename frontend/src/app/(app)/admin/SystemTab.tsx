"use client";

import { useTranslation } from "react-i18next";
import {
  useAdminLog,
  useAdminSettings,
  useBackupNow,
  useBackups,
  useSetFlag,
  useSystem,
  type Flag,
} from "@/admin/useAdmin";
import { ago, date, duration, number } from "@/admin/format";
import styles from "./admin.module.css";

function size(bytes: number) {
  if (bytes < 1024 * 1024) return `${number(bytes / 1024, 1)} KB`;
  if (bytes < 1024 ** 3) return `${number(bytes / 1024 ** 2, 1)} MB`;
  return `${number(bytes / 1024 ** 3, 2)} GB`;
}

const SWITCHES: Flag[] = ["signups", "play", "invites"];

// A copy older than this is worth a look: the server makes one a day.
const STALE_BACKUP = 26 * 3_600_000;

function Switches() {
  const { t } = useTranslation();
  const { data } = useAdminSettings();
  const setFlag = useSetFlag();
  return (
    <section className={`card ${styles.block}`}>
      <h2 className="label">{t("admin.switches")}</h2>
      {SWITCHES.map((flag) => {
        const on = data?.flags[flag] ?? true;
        return (
          <div key={flag} className={styles.switchRow}>
            <span className={styles.userName}>
              <b>{t(`admin.switch.${flag}.title`)}</b>
              <small>{t(`admin.switch.${flag}.text`)}</small>
            </span>
            <button
              className={styles.switch}
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={t(`admin.switch.${flag}.title`)}
              disabled={!data || setFlag.isPending}
              onClick={() => setFlag.mutate({ flag, on: !on })}
            />
          </div>
        );
      })}
      {setFlag.isError && <p className="error-text">{setFlag.error.message}</p>}
    </section>
  );
}

function Backups() {
  const { t } = useTranslation();
  const { data } = useBackups();
  const backup = useBackupNow();
  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.sectionHead}>
        <h2 className="label">{t("admin.backups")}</h2>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={backup.isPending}
          onClick={() => backup.mutate({})}
        >
          {backup.isPending ? t("admin.backingUp") : t("admin.backupNow")}
        </button>
      </div>
      {backup.isError && <p className="error-text">{backup.error.message}</p>}
      {data?.length === 0 && (
        <p className={styles.emptyBox}>{t("admin.noBackups")}</p>
      )}
      <ul className={styles.banList}>
        {data?.slice(0, 8).map((item) => (
          <li key={item.name}>
            <span className={styles.userName}>
              <b>{date(item.createdAt)}</b>
              <small className={styles.ellipsis}>{item.name}</small>
            </span>
            <span className={styles.dim}>{size(item.bytes)}</span>
          </li>
        ))}
      </ul>
      <p className={styles.dim}>{t("admin.backupHint")}</p>
    </section>
  );
}

function AuditLog() {
  const { t } = useTranslation();
  const { data } = useAdminLog();
  return (
    <section className={`card ${styles.block} ${styles.full}`}>
      <h2 className="label">{t("admin.auditTitle")}</h2>
      {data?.length === 0 && (
        <p className={styles.emptyBox}>{t("admin.auditEmpty")}</p>
      )}
      {!!data?.length && (
        <div className={styles.scroll}>
          <table className={`${styles.oddsTable} ${styles.textTable}`}>
            <thead>
              <tr>
                <th scope="col">{t("admin.audit.when")}</th>
                <th scope="col">{t("admin.audit.who")}</th>
                <th scope="col">{t("admin.audit.what")}</th>
                <th scope="col">{t("admin.audit.detail")}</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 30).map((entry) => (
                <tr key={entry.id}>
                  <td>{t("admin.agoShort", { time: ago(entry.createdAt) })}</td>
                  <td>{entry.admin}</td>
                  <td>
                    {t(`admin.log.${entry.accion}`, {
                      defaultValue: entry.accion,
                    })}
                    {entry.objetivo ? ` · ${entry.objetivo}` : ""}
                  </td>
                  <td className={styles.wrapCell}>{entry.detalle ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function SystemTab() {
  const { t } = useTranslation();
  const { data, isError, refetch } = useSystem();
  const backups = useBackups();

  if (isError) {
    return (
      <section className="card">
        <p className="muted">{t("common.error")}</p>
        <button className="btn btn-secondary" onClick={() => void refetch()}>
          {t("common.retry")}
        </button>
      </section>
    );
  }
  if (!data)
    return (
      <section className={`card ${styles.placeholder}`} aria-busy="true" />
    );

  const { metrics } = data;
  const p95 = Math.max(0, ...metrics.routes.map((route) => route.p95));
  const lastBackup = backups.data?.[0]?.createdAt ?? null;
  const staleBackup =
    lastBackup === null || Date.now() - lastBackup > STALE_BACKUP;
  const errorRate = metrics.count ? metrics.errors / metrics.count : 0;
  const allGood = !staleBackup && errorRate < 0.01;

  const tiles: { label: string; value: string; sub: string; warn?: boolean }[] =
    [
      {
        label: t("admin.uptime"),
        value: duration(data.uptime),
        sub: `Node ${data.node}`,
      },
      {
        label: t("admin.p95"),
        value: `${number(p95)} ms`,
        sub: t("admin.requests", { n: number(metrics.count) }),
      },
      {
        label: t("admin.errors"),
        value: number(metrics.errors),
        sub: t("admin.errorsSub"),
        warn: errorRate >= 0.01,
      },
      {
        label: t("admin.database"),
        value: size(data.database),
        sub: t("admin.rowsSub", { n: number(data.rows.hands) }),
      },
      {
        label: t("admin.photosCount"),
        value: number(data.photos),
        sub: size(data.mediaBytes),
      },
      {
        label: t("admin.lastBackup"),
        value: lastBackup
          ? t("admin.agoShort", { time: ago(lastBackup) })
          : "—",
        sub: staleBackup ? t("admin.backupStale") : t("admin.backupOk"),
        warn: staleBackup,
      },
    ];
  const slow = [...metrics.routes].sort((a, b) => b.p95 - a.p95).slice(0, 6);

  return (
    <>
      <div className={`${styles.statusLine} ${styles.full}`} data-ok={allGood}>
        <span className={styles.liveDot} data-on={allGood} />
        {allGood ? t("admin.allGood") : t("admin.needsLook")}
      </div>

      <div className={`card ${styles.tiles}`}>
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={styles.tile}
            data-warn={tile.warn ?? false}
          >
            <span className={styles.tileLabel}>{tile.label}</span>
            <span className={styles.tileValue}>{tile.value}</span>
            <span className={styles.dim}>{tile.sub}</span>
          </div>
        ))}
      </div>

      <Switches />
      <Backups />

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t("admin.slowRoutes")}</h2>
        {slow.length === 0 && (
          <p className={styles.emptyBox}>{t("admin.noTraffic")}</p>
        )}
        {slow.length > 0 && (
          <div className={styles.scroll}>
            <table className={styles.oddsTable}>
              <thead>
                <tr>
                  <th scope="col">{t("admin.route")}</th>
                  <th scope="col">{t("admin.calls")}</th>
                  <th scope="col">p50</th>
                  <th scope="col">p95</th>
                </tr>
              </thead>
              <tbody>
                {slow.map((route) => (
                  <tr key={route.route}>
                    <td className={styles.code}>{route.route}</td>
                    <td>{number(route.count)}</td>
                    <td>{number(route.p50)} ms</td>
                    <td>{number(route.p95)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.dim}>{t("admin.metricsHint")}</p>
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t("admin.recentErrors")}</h2>
        {metrics.recent.length === 0 && (
          <p className={styles.emptyBox}>{t("admin.noErrors")}</p>
        )}
        <ul className={styles.banList}>
          {metrics.recent.slice(0, 10).map((item, i) => (
            <li key={`${item.at}:${i}`}>
              <span className={styles.sev} data-level="high">
                {item.status}
              </span>
              <span className={styles.userName}>
                <b className={`${styles.ellipsis} ${styles.code}`}>
                  {item.route}
                </b>
                <small className={styles.ellipsis}>{item.message}</small>
              </span>
              <span className={styles.dim}>
                {t("admin.agoShort", { time: ago(item.at) })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <AuditLog />
    </>
  );
}
