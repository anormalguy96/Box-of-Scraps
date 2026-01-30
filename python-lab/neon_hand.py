import cv2
import numpy as np
import mediapipe as mp

mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils

def dist(a, b):
    return float(np.hypot(a[0]-b[0], a[1]-b[1]))

def finger_extended(lm, tip, pip):
    return lm[tip][1] < lm[pip][1]

def classify(lm):
    idx = finger_extended(lm, 8, 6)
    mid = finger_extended(lm, 12, 10)
    ring = finger_extended(lm, 16, 14)
    pink = finger_extended(lm, 20, 18)
    pinch = dist(lm[4], lm[8]) < 32
    point = idx and (not mid) and (not ring) and (not pink)
    fist = (not idx) and (not mid) and (not ring) and (not pink)
    return {"pinch": pinch, "point": point, "fist": fist}

cap = cv2.VideoCapture(0)
strokes = []
active = None

grabbed = None
last_grab = None

with mp_hands.Hands(
    model_complexity=0,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
) as hands:
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = hands.process(rgb)

        overlay = np.zeros_like(frame)

        if res.multi_hand_landmarks:
            hand = res.multi_hand_landmarks[0]
            lm = [(int(p.x*w), int(p.y*h)) for p in hand.landmark]
            g = classify(lm)
            cursor = lm[8]
            pinch_point = ((lm[4][0]+lm[8][0])//2, (lm[4][1]+lm[8][1])//2)

            if g["point"]:
                if active is None:
                    active = [cursor]
                    strokes.append(active)
                else:
                    if dist(active[-1], cursor) > 4:
                        active.append(cursor)
            else:
                active = None

            if g["pinch"]:
                if grabbed is None:
                    best = None
                    for si, s in enumerate(strokes):
                        for p in s:
                            d = dist(p, pinch_point)
                            if d < 26 and (best is None or d < best[0]):
                                best = (d, si)
                    grabbed = best[1] if best else None
                    last_grab = pinch_point
                else:
                    dx = pinch_point[0] - last_grab[0]
                    dy = pinch_point[1] - last_grab[1]
                    for i in range(len(strokes[grabbed])):
                        x,y = strokes[grabbed][i]
                        strokes[grabbed][i] = (x+dx, y+dy)
                    last_grab = pinch_point
            else:
                grabbed = None
                last_grab = None

            cv2.circle(overlay, cursor, 8, (255,255,255), -1)
            cv2.circle(overlay, pinch_point, 10, (0,255,255), 2)

            mp_draw.draw_landmarks(overlay, hand, mp_hands.HAND_CONNECTIONS)

        for s in strokes:
            if len(s) < 2: 
                continue
            for thickness, alpha in [(18, 0.12), (8, 0.22), (3, 0.95)]:
                color = (255, 200, 70) if thickness == 3 else (255, 255, 255)
                tmp = overlay.copy()
                cv2.polylines(tmp, [np.array(s, dtype=np.int32)], False, color, thickness, cv2.LINE_AA)
                overlay = cv2.addWeighted(overlay, 1.0, tmp, alpha, 0)

        out = cv2.addWeighted(frame, 1.0, overlay, 1.0, 0)
        cv2.putText(out, "ESC to quit | point=draw | pinch=grab", (14, 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2, cv2.LINE_AA)
        cv2.imshow("Neon Hand (Python Lab)", out)

        k = cv2.waitKey(1) & 0xFF
        if k == 27:
            break

cap.release()
cv2.destroyAllWindows()
