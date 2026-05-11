-- Seed: Pesticides
-- Description: Initial catalog of 9 pesticides commonly used on hot pepper
--              farms in Israel. Some entries are 'verified' with full safety
--              data (PHI, REI, PPE, hazard level) and some are 'unverified'
--              where safety fields are NULL - those will trigger the
--              "consult the official label" warning in the worker form.

SET IDENTITY_INSERT Pesticides ON;

INSERT INTO Pesticides
    (PesticideId, Name, ActiveIngredient, Manufacturer, TargetPest,
     PreHarvestIntervalDays, ReEntryIntervalHours, PpeRequired, HazardLevel,
     VerificationStatus)
VALUES
    -- Verified entries: all safety data is known and trusted by the agronomist
    (1, 'Confidor', 'Imidacloprid', 'Bayer',
     'Aphids, whiteflies',
     7,  12, 'Gloves, mask, long sleeves', 'medium', 'verified'),

    (2, 'Vertimec', 'Abamectin', 'Syngenta',
     'Mites, leaf miners',
     7,  12, 'Gloves, mask, goggles',      'high',   'verified'),

    (3, 'Movento', 'Spirotetramat', 'Bayer',
     'Aphids, whiteflies, scale',
     3,  24, 'Gloves, long sleeves',       'low',    'verified'),

    (4, 'Mospilan', 'Acetamiprid', 'Nippon Soda',
     'Aphids, thrips, whiteflies',
     3,  12, 'Gloves, mask',               'low',    'verified'),

    (5, 'Topaz', 'Penconazole', 'Syngenta',
     'Powdery mildew',
     14, 12, 'Gloves, mask',               'medium', 'verified'),

    -- Unverified entries: agronomist has not yet supplied PHI/REI/PPE.
    -- The form will show the "consult the official label" warning when these
    -- are selected.
    (6, 'Switch',   'Cyprodinil + Fludioxonil', 'Syngenta',
     'Botrytis, gray mold',
     NULL, NULL, NULL, NULL, 'unverified'),

    (7, 'NimGard',  'Azadirachtin (neem)',      'Stockton',
     'Soft-bodied insects, mites',
     NULL, NULL, NULL, NULL, 'unverified'),

    (8, 'Actellik', 'Pirimiphos-methyl',        'Syngenta',
     'Storage pests, beetles',
     NULL, NULL, NULL, NULL, 'unverified'),

    (9, 'Saifan',   'Sulfur',                   'Adama',
     'Powdery mildew, mites',
     NULL, NULL, NULL, NULL, 'unverified');

SET IDENTITY_INSERT Pesticides OFF;