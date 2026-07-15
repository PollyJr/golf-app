ALTER TABLE admin_accounts ADD CONSTRAINT admin_accounts_club_id_unique UNIQUE (club_id, id);
ALTER TABLE players ADD CONSTRAINT players_club_id_unique UNIQUE (club_id, id);
ALTER TABLE tee_sets ADD CONSTRAINT tee_sets_club_id_unique UNIQUE (club_id, id);
ALTER TABLE round_participants ADD CONSTRAINT round_participants_club_id_unique UNIQUE (club_id, id);
ALTER TABLE rounds ADD CONSTRAINT rounds_club_id_unique UNIQUE (club_id, id);
ALTER TABLE events ADD CONSTRAINT events_club_id_unique UNIQUE (club_id, id);

ALTER TABLE tee_sets ADD CONSTRAINT tee_sets_course_tenant_fk
  FOREIGN KEY (club_id, course_id) REFERENCES courses (club_id, id);
ALTER TABLE holes ADD CONSTRAINT holes_course_tenant_fk
  FOREIGN KEY (club_id, course_id) REFERENCES courses (club_id, id);
ALTER TABLE holes ADD CONSTRAINT holes_tee_tenant_fk
  FOREIGN KEY (club_id, tee_set_id) REFERENCES tee_sets (club_id, id);
ALTER TABLE rounds ADD CONSTRAINT rounds_course_tenant_fk
  FOREIGN KEY (club_id, course_id) REFERENCES courses (club_id, id);
ALTER TABLE rounds ADD CONSTRAINT rounds_tee_tenant_fk
  FOREIGN KEY (club_id, tee_set_id) REFERENCES tee_sets (club_id, id);
ALTER TABLE rounds ADD CONSTRAINT rounds_scorer_tenant_fk
  FOREIGN KEY (club_id, scorer_player_id) REFERENCES players (club_id, id);
ALTER TABLE round_participants ADD CONSTRAINT participants_player_tenant_fk
  FOREIGN KEY (club_id, player_id) REFERENCES players (club_id, id);
ALTER TABLE hole_scores ADD CONSTRAINT scores_participant_tenant_fk
  FOREIGN KEY (club_id, round_participant_id) REFERENCES round_participants (club_id, id);
ALTER TABLE round_reviews ADD CONSTRAINT reviews_round_tenant_fk
  FOREIGN KEY (club_id, round_id) REFERENCES rounds (club_id, id);
ALTER TABLE round_reviews ADD CONSTRAINT reviews_admin_tenant_fk
  FOREIGN KEY (club_id, reviewer_id) REFERENCES admin_accounts (club_id, id);
ALTER TABLE events ADD CONSTRAINT events_course_tenant_fk
  FOREIGN KEY (club_id, course_id) REFERENCES courses (club_id, id);
ALTER TABLE event_registrations ADD CONSTRAINT registrations_event_tenant_fk
  FOREIGN KEY (club_id, event_id) REFERENCES events (club_id, id);
ALTER TABLE event_registrations ADD CONSTRAINT registrations_player_tenant_fk
  FOREIGN KEY (club_id, player_id) REFERENCES players (club_id, id);
