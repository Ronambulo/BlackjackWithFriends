ALTER TABLE `profiles` ADD `manos_semana` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `apostado_semana` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `season_standings` ADD `clasificado` integer DEFAULT true NOT NULL;--> statement-breakpoint
-- This week's numbers so far, from the hands. The week opens Monday 00:00 in Madrid: two hours
-- before UTC midnight in summer time (from the last Sunday of March to the last one of October), one in winter.
UPDATE `profiles` SET (`manos_semana`, `apostado_semana`) = (
  SELECT count(*), coalesce(sum(coalesce(json_extract(h.`ronda`, '$.settlement.totalWagered'), h.`apuesta`)), 0)
  FROM `hands` h
  WHERE h.`user_id` = `profiles`.`id` AND h.`fase` = 'settled' AND h.`created_at` >= 1000 * (unixepoch(`profiles`.`semana`) - CASE
    WHEN cast(strftime('%m', `profiles`.`semana`) AS integer) BETWEEN 4 AND 9
      OR (strftime('%m', `profiles`.`semana`) = '03' AND cast(strftime('%d', `profiles`.`semana`) AS integer) >= 26)
      OR (strftime('%m', `profiles`.`semana`) = '10' AND cast(strftime('%d', `profiles`.`semana`) AS integer) <= 25)
    THEN 7200 ELSE 3600 END)
);
