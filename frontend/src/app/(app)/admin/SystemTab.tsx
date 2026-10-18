"use client";

import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  useAdminSettings,
  useBackupNow,
  useBackups,
  useDeleteReport,
  useReports,
  useResolveReport,
  useRestoreBackup,
  useSetFlag,
  useSetMaintenance,
  useSystem,
  type Backup,
  type Flag,
} from "@/admin/useAdmin";
import { ago, date, duration, number } from "@/admin/format";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { CheckIcon, RenewIcon, TimerIcon, TrashIcon } from "@/ui/icons";
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

function Maintenance() {
  const { t } = useTranslation();
  const { data } = useAdminSettings();
  const setMaintenance = useSetMaintenance();
  const [message, setMessage] = useState("");
  const [asking, setAsking] = useState(false);
  const current = data?.maintenance ?? null;
  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.switchRow}>
        <span className={styles.userName}>
          <b>{t("admin.maintenance.title")}</b>
          <small>
            {current
              ? t("admin.maintenance.onSince", {
                  time: ago(current.since),
                  who: current.by,
                })
              : t("admin.maintenance.text")}
          </small>
        </span>
        <button
          className={styles.switch}
          type="button"
          role="switch"
          aria-checked={!!current}
          aria-label={t("admin.maintenance.title")}
          disabled={!data || setMaintenance.isPending}
          onClick={() =>
            current ? setMaintenance.mutate({ on: false }) : setAsking(true)
          }
        />
      </div>
      {current?.message && <p className={styles.dim}>“{current.message}”</p>}
      {!current && (
        <label className="field">
          <span className="field-label">
            {t("admin.maintenance.message")}
          </span>
          <textarea
            className={`${styles.fieldInput} ${styles.textarea}`}
            rows={4}
            maxLength={200}
            placeholder={t("maintenance.text")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
      )}
      {setMaintenance.isError && (
        <p className="error-text">{setMaintenance.error.message}</p>
      )}
      <ConfirmSheet
        open={asking}
        icon={<TimerIcon />}
        title={t("admin.maintenance.confirmTitle")}
        text={t("admin.maintenance.confirmText")}
        confirm={t("admin.maintenance.confirm")}
        busy={setMaintenance.isPending}
        onConfirm={() =>
          setMaintenance.mutate(
            { on: true, message: message.trim() || undefined },
            {
              onSuccess: () => {
                setAsking(false);
                setMessage("");
              },
            },
          )
        }
        onCancel={() => setAsking(false)}
      />
    </section>
  );
}

function Backups() {
  const { t } = useTranslation();
  const { data } = useBackups();
  const backup = useBackupNow();
  const restore = useRestoreBackup();
  const [restoring, setRestoring] = useState<Backup | null>(null);
  return (
    <section className={`card ${styles.block}`}>
      <div className={styles.sectionHead}>
        <h2 className="label">{t("admin.backups")}</h2>
        <div className={styles.headActions}>
          <a
            className="btn btn-secondary"
            href="/api/admin/backups/download"
            download
          >
            {t("admin.downloadDb")}
          </a>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={backup.isPending}
            onClick={() => backup.mutate({})}
          >
            {backup.isPending ? t("admin.backingUp") : t("admin.backupNow")}
          </button>
        </div>
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
              <small className={styles.wrapText}>{item.name}</small>
            </span>
            <span className={styles.dim}>{size(item.bytes)}</span>
            <a
              className="btn btn-ghost"
              href={`/api/admin/backups/download?name=${encodeURIComponent(item.name)}`}
              download
              aria-label={t("admin.download")}
            >
              ↓
            </a>
            <button
              className="btn btn-ghost"
              type="button"
              aria-label={t("admin.restore.button")}
              title={t("admin.restore.button")}
              onClick={() => {
                restore.reset();
                setRestoring(item);
              }}
            >
              <RenewIcon width={16} height={16} />
            </button>
          </li>
        ))}
      </ul>
      {restore.isSuccess && (
        <p className={styles.dim}>
          {t("admin.restore.done", { name: restore.data.before })}
        </p>
      )}
      <p className={styles.dim}>{t("admin.backupHint")}</p>
      <ConfirmSheet
        open={restoring !== null}
        icon={<RenewIcon />}
        title={t("admin.restore.title", {
          when: restoring ? date(restoring.createdAt) : "",
        })}
        text={
          <>
            {t("admin.restore.text")}
            {restore.isError && (
              <span className="error-text" style={{ display: "block" }}>
                {restore.error.message}
              </span>
            )}
          </>
        }
        confirm={t("admin.restore.confirm")}
        stacked
        busy={restore.isPending}
        onConfirm={() =>
          restoring &&
          restore.mutate(restoring.name, {
            onSuccess: () => setRestoring(null),
          })
        }
        onCancel={() => setRestoring(null)}
      />
    </section>
  );
}

function Reports() {
  const { t } = useTranslation();
  const { data } = useReports();
  const resolve = useResolveReport();
  const remove = useDeleteReport();
  const [showDone, setShowDone] = useState(false);
  const open = data?.filter((report) => !report.resuelto) ?? [];
  const list = showDone ? (data ?? []) : open;
  return (
    <section className={`card ${styles.block} ${styles.full}`}>
      <div className={styles.sectionHead}>
        <h2 className="label">
          {t("admin.reports.title")}
          {open.length > 0 && ` · ${open.length}`}
        </h2>
        {data && data.length > open.length && (
          <button
            type="button"
            className={styles.link}
            onClick={() => setShowDone(!showDone)}
          >
            {showDone
              ? t("admin.reports.hideDone")
              : t("admin.reports.showDone")}
          </button>
        )}
      </div>
      {list.length === 0 && (
        <p className={styles.emptyBox}>{t("admin.reports.empty")}</p>
      )}
      <ul className={styles.reports}>
        {list.map((report) => (
          <li key={report.id} data-done={report.resuelto}>
            <div className={styles.reportHead}>
              <b>@{report.username}</b>
              <span className={styles.dim}>
                {t("admin.agoShort", { time: ago(report.createdAt) })}
                {report.ruta ? ` · ${report.ruta}` : ""}
              </span>
            </div>
            <p className={styles.reportText}>{report.texto}</p>
            {report.dispositivo && (
              <small className={`${styles.dim} ${styles.ellipsis}`}>
                {report.dispositivo}
              </small>
            )}
            <div className={styles.reportActions}>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={resolve.isPending}
                onClick={() =>
                  resolve.mutate({ id: report.id, ok: !report.resuelto })
                }
              >
                <CheckIcon width={16} height={16} />
                {report.resuelto
                  ? t("admin.reports.reopen")
                  : t("admin.reports.resolve")}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                aria-label={t("admin.reports.delete")}
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: report.id })}
              >
                <TrashIcon width={16} height={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.dim}>{t("admin.reports.hint")}</p>
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

      <Reports />
      <Maintenance />
      <Switches />
      <Backups />

      <section className={`card ${styles.block} ${styles.span2}`}>
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

    </>
  );
}

/** The shop's entries name a style or a kind: shown by name, not by id. */
export function target(accion: string, objetivo: string, t: TFunction): string {
  // A style taken out of the game keeps its id in the log: shown as a plain name.
  if (accion === "shop_item") {
    const plain = objetivo.split(".").pop() ?? objetivo;
    return t(`styles.items.${objetivo}`, { defaultValue: plain.charAt(0).toUpperCase() + plain.slice(1) });
  }
  if (accion === "shop_order") return t(`styles.kind.${objetivo}`, { defaultValue: objetivo });
  if (accion === "export") return t(`admin.export.${objetivo}`, { defaultValue: objetivo });
  if (accion === "flag_on" || accion === "flag_off")
    return t(`admin.switch.${objetivo}.title`, { defaultValue: objetivo });
  return objetivo;
}

/** A style's change is saved as "price · oferta N · retirado": spelled out here. */
export function detail(accion: string, detalle: string | null, t: TFunction): string {
  if (!detalle) return "—";
  if (accion !== "shop_item") return detalle;
  const [price, ...rest] = detalle.split(" · ");
  const offer = rest.find((part) => part.startsWith("oferta "));
  return [
    t("admin.shop.logPrice", { n: number(Number(price)) }),
    offer && t("admin.shop.logOffer", { n: number(Number(offer.slice(7))) }),
    rest.includes("retirado") ? t("admin.shop.off") : t("admin.shop.on"),
  ]
    .filter(Boolean)
    .join(" · ");
}
