package main

import (
	crand "crypto/rand"
	"encoding/json"
	"encoding/hex"
	"fmt"
	"html/template"
	"log"
	"math"
	"math/rand/v2"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"github.com/glebarez/sqlite"
)

// --- Game Database and Config Structures ---

type Stats struct {
	Strength     int `json:"strength"`
	Intelligence int `json:"intelligence"`
	Dexterity    int `json:"dexterity"`
	Luck         int `json:"luck"`
}

type Equipment struct {
	Weapon *string `json:"weapon"`
	Armor  *string `json:"armor"`
	Ring   *string `json:"ring"`
}

type QuestState struct {
	Active    bool    `json:"active"`
	QuestID   *string `json:"questId"`
	StartTime *int64  `json:"startTime"`
	Duration  *int64  `json:"duration"`
}

type Character struct {
	Name       string     `json:"name"`
	Class      string     `json:"class"`
	Level      int        `json:"level"`
	XP         int        `json:"xp"`
	XPNeeded   int        `json:"xpNeeded"`
	Gold       int        `json:"gold"`
	BaseStats  Stats      `json:"baseStats" gorm:"embedded;embeddedPrefix:base_"`
	Stats      Stats      `json:"stats" gorm:"-"`
	StatPoints int        `json:"statPoints"`
	HP         int        `json:"hp"`
	MaxHP      int        `json:"maxHp" gorm:"-"`
	MP         int        `json:"mp"`
	MaxMP      int        `json:"maxMp" gorm:"-"`
	Equipment  Equipment  `json:"equipment" gorm:"embedded;embeddedPrefix:eq_"`
	Inventory  []string   `json:"inventory" gorm:"serializer:json"`
	QuestState QuestState `json:"questState" gorm:"embedded;embeddedPrefix:quest_"`
	Logs       []string   `json:"logs" gorm:"serializer:json"`
}

type User struct {
	Username     string    `json:"username" gorm:"primaryKey"`
	Password     string    `json:"password"`
	IsGuest      bool      `json:"is_guest"`
	LastActiveAt time.Time `json:"last_active_at"`
	Character    Character `json:"character" gorm:"embedded"`
}

type Session struct {
	SessionID string    `gorm:"primaryKey"`
	Username  string    `gorm:"index"`
	CreatedAt time.Time
}

func (u *User) AfterFind(tx *gorm.DB) (err error) {
	recalculateCharacter(&u.Character)
	return
}

type ChatMessage struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username"`
	CharName  string    `json:"charName"`
	Class     string    `json:"class"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

// Static Metadata definitions
type ShopItem struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	Slot        *string `json:"slot,omitempty"`
	Cost        int     `json:"cost"`
	HealAmount  int     `json:"healAmount,omitempty"`
	Stats       *Stats  `json:"stats,omitempty"`
	HPBonus     int     `json:"hpBonus,omitempty"`
	Description string  `json:"description"`
}

type Quest struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Duration    int64  `json:"duration"` // Milliseconds
	XPReward    int    `json:"xpReward"`
	GoldReward  int    `json:"goldReward"`
	MinDmg      int    `json:"minDmg"`
	MaxDmg      int    `json:"maxDmg"`
	Description string `json:"description"`
}

var SHOP_ITEMS = map[string]ShopItem{
	"potion": {ID: "potion", Name: "Health Potion", Type: "consumable", Cost: 10, HealAmount: 50, Description: "Heals 50 HP instantly"},
	"sword":  {ID: "sword", Name: "Go Compiler Blade", Type: "weapon", Slot: ptrString("weapon"), Cost: 50, Stats: &Stats{Strength: 6}, Description: "+6 Strength (Go Weapon)"},
	"staff":  {ID: "staff", Name: "Routine Channel Wand", Type: "weapon", Slot: ptrString("weapon"), Cost: 50, Stats: &Stats{Intelligence: 6}, Description: "+6 Intelligence (Go Weapon)"},
	"armor":  {ID: "armor", Name: "Rust Safe Shield", Type: "armor", Slot: ptrString("armor"), Cost: 75, Stats: &Stats{Strength: 2, Dexterity: -1}, HPBonus: 40, Description: "+40 Max HP, +2 Str, -1 Dex (Rust Armor)"},
	"ring":   {ID: "ring", Name: "Ownership Ring", Type: "ring", Slot: ptrString("ring"), Cost: 100, Stats: &Stats{Luck: 8}, Description: "+8 Luck (Rust Accessory)"},
}

var QUESTS = map[string]Quest{
	"quest1": {ID: "quest1", Name: "간단한 버그 픽스", Duration: 5000, XPReward: 15, GoldReward: 8, MinDmg: 2, MaxDmg: 5, Description: "쉬움. 사소한 UI 버그를 수정합니다."},
	"quest2": {ID: "quest2", Name: "레거시 코드 리팩토링", Duration: 10000, XPReward: 35, GoldReward: 20, MinDmg: 5, MaxDmg: 12, Description: "보통. 스파게티 코드를 정리합니다."},
	"quest3": {ID: "quest3", Name: "신규 코어 피처 개발", Duration: 20000, XPReward: 80, GoldReward: 50, MinDmg: 12, MaxDmg: 25, Description: "어려움. 핵심 비즈니스 로직을 개발합니다."},
	"quest4": {ID: "quest4", Name: "운영 DB 마이그레이션", Duration: 40000, XPReward: 200, GoldReward: 150, MinDmg: 30, MaxDmg: 60, Description: "전설. 라이브 DB 스키마를 변경합니다. 위험!"},
}

func ptrString(s string) *string {
	return &s
}

// --- Global App Variables (State) ---

const (
	SESSION_NAME = "rpg_session"
)

func getDbFilePath() string {
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		return "db.json"
	}
	return filepath.Join(dataDir, "db.json")
}

var (
	// GORM Database instance
	db *gorm.DB

	lastActiveUpdate sync.Map
)

// --- Database Helper Functions ---

func initDB() {
	dbFile := getDbFilePath()
	if strings.HasSuffix(dbFile, ".json") {
		dbFile = strings.Replace(dbFile, ".json", ".sqlite", 1)
	}

	var err error
	db, err = gorm.Open(sqlite.Open(dbFile), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect database:", err)
	}

	// Auto Migrate the schema
	db.AutoMigrate(&User{}, &ChatMessage{}, &Session{})

	// Seed admin if not exists
	var admin User
	if err := db.First(&admin, "username = ?", "admin").Error; err != nil {
		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		adminChar := Character{
			Name:       "admin",
			Class:      "GameMaster",
			Level:      999,
			XP:         0,
			XPNeeded:   999999,
			Gold:       999999,
			BaseStats:  Stats{Strength: 999, Intelligence: 999, Dexterity: 999, Luck: 999},
			HP:         9999,
			MaxHP:      9999,
			MP:         9999,
			MaxMP:      9999,
			Inventory:  []string{},
			Logs:       []string{"Game Master account created."},
		}
		recalculateCharacter(&adminChar)
		adminUser := User{
			Username:  "admin",
			Password:  string(hashedPassword),
			Character: adminChar,
		}
		db.Create(&adminUser)
	}
}

// --- RPG Logic Functions ---

func recalculateCharacter(char *Character) {
	// Base Stats config by class
	var baseMaxHP int
	var baseMaxMP int

	switch char.Class {
	case "GopherWarrior":
		baseMaxHP = 125
		baseMaxMP = 35
	case "RoutineMage":
		baseMaxHP = 80
		baseMaxMP = 100
	case "FerrisKnight":
		baseMaxHP = 140
		baseMaxMP = 30
	case "BorrowCheckerRogue":
		baseMaxHP = 95
		baseMaxMP = 45
	default:
		baseMaxHP = 100
		baseMaxMP = 50
	}

	// Copy base stats
	char.Stats = char.BaseStats
	hpBonus := 0

	// Weapon slot check
	if char.Equipment.Weapon != nil {
		if item, ok := SHOP_ITEMS[*char.Equipment.Weapon]; ok {
			applyItemStats(&char.Stats, item.Stats)
			hpBonus += item.HPBonus
		}
	}
	// Armor slot check
	if char.Equipment.Armor != nil {
		if item, ok := SHOP_ITEMS[*char.Equipment.Armor]; ok {
			applyItemStats(&char.Stats, item.Stats)
			hpBonus += item.HPBonus
		}
	}
	// Ring slot check
	if char.Equipment.Ring != nil {
		if item, ok := SHOP_ITEMS[*char.Equipment.Ring]; ok {
			applyItemStats(&char.Stats, item.Stats)
			hpBonus += item.HPBonus
		}
	}

	char.MaxHP = baseMaxHP + hpBonus
	char.MaxMP = baseMaxMP

	if char.HP > char.MaxHP {
		char.HP = char.MaxHP
	}
	if char.HP < 0 {
		char.HP = 0
	}
}

func applyItemStats(charStats *Stats, itemStats *Stats) {
	if itemStats == nil {
		return
	}
	charStats.Strength += itemStats.Strength
	charStats.Intelligence += itemStats.Intelligence
	charStats.Dexterity += itemStats.Dexterity
	charStats.Luck += itemStats.Luck
}

// --- Session Helper Functions ---

func generateSessionID() string {
	bytes := make([]byte, 16)
	if _, err := crand.Read(bytes); err != nil {
		log.Println("Session token rand error:", err)
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes)
}

func getLoggedInUser(r *http.Request) (string, bool) {
	cookie, err := r.Cookie(SESSION_NAME)
	if err != nil {
		return "", false
	}

	var session Session
	if err := db.First(&session, "session_id = ?", cookie.Value).Error; err != nil {
		return "", false
	}
	username := session.Username

	last, loaded := lastActiveUpdate.Load(username)
	if !loaded || time.Since(last.(time.Time)) > time.Minute {
		lastActiveUpdate.Store(username, time.Now())
		go func(u string) {
			db.Model(&User{}).Where("username = ?", u).Update("last_active_at", time.Now())
		}(username)
	}

	return username, true
}

// --- HTTP Helpers ---

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func errorResponse(w http.ResponseWriter, status int, msg string) {
	jsonResponse(w, status, map[string]string{"error": msg})
}

// --- Request DTOs ---

type AuthRequest struct {
	Username  string `json:"username"`
	Password  string `json:"password"`
	CharClass string `json:"charClass"`
	CharName  string `json:"charName"`
}

type QuestRequest struct {
	Action  string `json:"action"`
	QuestID string `json:"questId"`
}

type TrainRequest struct {
	Stat string `json:"stat"`
}

type BuyRequest struct {
	ItemID string `json:"itemId"`
}

type ItemActionRequest struct {
	Action string  `json:"action"`
	ItemID string  `json:"itemId"`
	Slot   *string `json:"slot"`
}

// --- Handlers ---

func registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.CharClass == "" || req.CharName == "" {
		errorResponse(w, http.StatusBadRequest, "Character Name and Class are required")
		return
	}

	// Ensure character name is unique
	var existingUser User
	if err := db.Where("name = ?", strings.TrimSpace(req.CharName)).First(&existingUser).Error; err == nil {
		errorResponse(w, http.StatusBadRequest, "이미 존재하는 캐릭터 이름입니다. 다른 이름을 사용해주세요.")
		return
	}

	// Generate a random guest ID
	b := make([]byte, 4)
	crand.Read(b)
	guestID := fmt.Sprintf("guest_%s", hex.EncodeToString(b))
	guestPassword := hex.EncodeToString(b)
	normalizedUser := guestID

	// Class-based initial stats
	var baseStats Stats
	var equipment Equipment

	switch req.CharClass {
	case "GopherWarrior":
		baseStats = Stats{Strength: 13, Intelligence: 8, Dexterity: 11, Luck: 10}
		weaponStr := "sword"
		equipment.Weapon = &weaponStr
	case "RoutineMage":
		baseStats = Stats{Strength: 6, Intelligence: 15, Dexterity: 8, Luck: 11}
		weaponStr := "staff"
		equipment.Weapon = &weaponStr
	case "FerrisKnight":
		baseStats = Stats{Strength: 11, Intelligence: 8, Dexterity: 8, Luck: 13}
		armorStr := "armor"
		equipment.Armor = &armorStr
	case "BorrowCheckerRogue":
		baseStats = Stats{Strength: 8, Intelligence: 10, Dexterity: 14, Luck: 10}
		ringStr := "ring"
		equipment.Ring = &ringStr
	case "NodeNinja":
		baseStats = Stats{Strength: 9, Intelligence: 9, Dexterity: 15, Luck: 9}
		wStr := "sword"
		equipment.Weapon = &wStr
	case "NodeSummoner":
		baseStats = Stats{Strength: 5, Intelligence: 14, Dexterity: 10, Luck: 13}
		wStr := "staff"
		equipment.Weapon = &wStr
	case "PythonRanger":
		baseStats = Stats{Strength: 7, Intelligence: 12, Dexterity: 13, Luck: 10}
		wStr := "staff"
		equipment.Weapon = &wStr
	case "PythonBerserker":
		baseStats = Stats{Strength: 15, Intelligence: 5, Dexterity: 9, Luck: 13}
		wStr := "sword"
		equipment.Weapon = &wStr
	case "JavaKnight":
		baseStats = Stats{Strength: 12, Intelligence: 10, Dexterity: 8, Luck: 12}
		aStr := "armor"
		equipment.Armor = &aStr
	case "JavaCleric":
		baseStats = Stats{Strength: 6, Intelligence: 14, Dexterity: 8, Luck: 14}
		rStr := "ring"
		equipment.Ring = &rStr
	default:
		errorResponse(w, http.StatusBadRequest, "Invalid class selection")
		return
	}

	char := Character{
		Name:      strings.TrimSpace(req.CharName),
		Class:     req.CharClass,
		Level:     1,
		XP:        0,
		XPNeeded:  100,
		Gold:      30,
		BaseStats: baseStats,
		Equipment: equipment,
		Inventory: []string{"potion"},
		QuestState: QuestState{
			Active: false,
		},
		Logs: []string{fmt.Sprintf("Character %s the %s was created! Welcome to the adventure.", req.CharName, req.CharClass)},
	}

	recalculateCharacter(&char)
	char.HP = char.MaxHP // Maximize HP initially

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(guestPassword), bcrypt.DefaultCost)
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	newUser := User{
		Username:  normalizedUser,
		Password:  string(hashedPassword),
		IsGuest:   true,
		Character: char,
	}
	if err := db.Create(&newUser).Error; err != nil {
		errorResponse(w, http.StatusInternalServerError, "Failed to write database")
		return
	}

	// Create session
	sessID := generateSessionID()
	db.Save(&Session{
		SessionID: sessID,
		Username:  normalizedUser,
		CreatedAt: time.Now(),
	})

	http.SetCookie(w, &http.Cookie{
		Name:     SESSION_NAME,
		Value:    sessID,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   86400, // 24 hours
		SameSite: http.SameSiteLaxMode,
	})

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"message":   "Registration successful",
		"character": char,
		"isGuest":   true,
	})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	normalizedUser := strings.ToLower(strings.TrimSpace(req.Username))
	var user User
	if err := db.First(&user, "username = ?", normalizedUser).Error; err != nil {
		errorResponse(w, http.StatusBadRequest, "길드원 정보가 올바르지 않습니다. (이름 또는 비밀번호 오류)")
		return
	}

	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		errorResponse(w, http.StatusBadRequest, "길드원 정보가 올바르지 않습니다. (이름 또는 비밀번호 오류)")
		return
	}

	char := user.Character
	recalculateCharacter(&char)

	// Save back to db in case of calculation updates
	user.Character = char
	db.Save(&user)

	// Create session
	sessID := generateSessionID()
	db.Save(&Session{
		SessionID: sessID,
		Username:  normalizedUser,
		CreatedAt: time.Now(),
	})

	http.SetCookie(w, &http.Cookie{
		Name:     SESSION_NAME,
		Value:    sessID,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   86400,
		SameSite: http.SameSiteLaxMode,
	})

	role := "user"
	if normalizedUser == "admin" {
		role = "admin"
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"message":   "Login successful",
		"character": char,
		"role":      role,
		"isGuest":   user.IsGuest,
	})
}

func linkAccountHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	username, ok := getLoggedInUser(r)
	if !ok {
		errorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		errorResponse(w, http.StatusBadRequest, "Username and Password are required")
		return
	}

	var user User
	if err := db.First(&user, "username = ?", username).Error; err != nil {
		errorResponse(w, http.StatusUnauthorized, "User not found")
		return
	}

	if !user.IsGuest {
		errorResponse(w, http.StatusBadRequest, "Account is already linked")
		return
	}

	newUsername := strings.ToLower(strings.TrimSpace(req.Username))
	
	// Check if new username exists
	var existing User
	if err := db.Where("username = ?", newUsername).First(&existing).Error; err == nil {
		errorResponse(w, http.StatusBadRequest, "Username already taken")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	// In GORM, changing the primary key means we need to insert a new record and delete the old one, OR update the column directly.
	// We'll update the column directly using db.Exec to be safe.
	err = db.Exec("UPDATE users SET username = ?, password = ?, is_guest = ? WHERE username = ?", newUsername, string(hashedPassword), false, username).Error
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "Failed to update account")
		return
	}

	// Update session
	cookie, _ := r.Cookie(SESSION_NAME)
	db.Model(&Session{}).Where("session_id = ?", cookie.Value).Update("username", newUsername)

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"message": "Account linked successfully",
	})
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	cookie, err := r.Cookie(SESSION_NAME)
	if err == nil {
		db.Delete(&Session{}, "session_id = ?", cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     SESSION_NAME,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		SameSite: http.SameSiteLaxMode,
	})

	jsonResponse(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func meHandler(w http.ResponseWriter, r *http.Request) {
	username, ok := getLoggedInUser(r)
	if !ok {
		errorResponse(w, http.StatusUnauthorized, "Unauthorized. Please log in.")
		return
	}

	

	var user User
	if err := db.First(&user, "username = ?", username).Error; err != nil {
		errorResponse(w, http.StatusNotFound, "Character not found")
		return
	}

	char := user.Character
	recalculateCharacter(&char)

	role := "user"
	if username == "admin" {
		role = "admin"
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"character": char,
		"role":      role,
	})
}

func questHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	username, ok := getLoggedInUser(r)
	if !ok {
		errorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req QuestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	

	var user User
	if err := db.First(&user, "username = ?", username).Error; err != nil {
		errorResponse(w, http.StatusInternalServerError, "Database error")
		return
	}
	char := &user.Character

	if req.Action == "start" {
		if char.QuestState.Active {
			errorResponse(w, http.StatusBadRequest, "You are already on an active quest!")
			return
		}
		if char.HP <= 10 {
			errorResponse(w, http.StatusBadRequest, "Your HP is too low! Rest or consume a potion first.")
			return
		}

		quest, exists := QUESTS[req.QuestID]
		if !exists {
			errorResponse(w, http.StatusBadRequest, "Invalid quest selected.")
			return
		}

		startTime := time.Now().UnixMilli()
		duration := quest.Duration

		char.QuestState = QuestState{
			Active:    true,
			QuestID:   &req.QuestID,
			StartTime: &startTime,
			Duration:  &duration,
		}

		logMsg := fmt.Sprintf("Started quest: \"%s\". It will take %d seconds.", quest.Name, quest.Duration/1000)
		char.Logs = append([]string{logMsg}, char.Logs...)

		db.Save(&user)
		jsonResponse(w, http.StatusOK, map[string]interface{}{"character": char})
		return
	}

	if req.Action == "complete" {
		if !char.QuestState.Active {
			errorResponse(w, http.StatusBadRequest, "You are not currently on any quest.")
			return
		}

		quest := QUESTS[*char.QuestState.QuestID]
		timeElapsed := time.Now().UnixMilli() - *char.QuestState.StartTime

		if timeElapsed < *char.QuestState.Duration {
			errorResponse(w, http.StatusBadRequest, "Quest is not yet completed! Please wait.")
			return
		}

		// Mitigation Math
		mitigation := int(math.Floor(float64(char.Stats.Strength)*0.4 + float64(char.Stats.Dexterity)*0.2))
		
		// Damage taken
		rawDmg := rand.N(quest.MaxDmg-quest.MinDmg+1) + quest.MinDmg
		actualDmg := rawDmg - mitigation
		if actualDmg < 1 {
			actualDmg = 1
		}

		char.HP -= actualDmg
		if char.HP < 0 {
			char.HP = 0
		}

		// Rewards
		goldEarned := quest.GoldReward
		xpEarned := quest.XPReward

		// Luck adjustments
		luckBonus := float64(char.Stats.Luck) / 100.0
		goldEarned = int(float64(goldEarned) * (1.0 + luckBonus*1.5))
		xpEarned = int(float64(xpEarned) * (1.0 + luckBonus*0.5))

		// Loot roll
		lootRoll := rand.Float64() + luckBonus
		var itemsFound []string
		if lootRoll > 0.85 {
			char.Inventory = append(char.Inventory, "potion")
			itemsFound = append(itemsFound, "Health Potion")
		}

		resultMsg := fmt.Sprintf("Completed: \"%s\"! Took %d damage. Gained +%d XP, +%d Gold.", quest.Name, actualDmg, xpEarned, goldEarned)
		if len(itemsFound) > 0 {
			resultMsg += fmt.Sprintf(" Found: %s!", strings.Join(itemsFound, ", "))
		}
		char.Logs = append([]string{resultMsg}, char.Logs...)

		char.Gold += goldEarned
		char.XP += xpEarned

		// Level Up check
		levelUps := 0
		for char.XP >= char.XPNeeded {
			levelUps++
			char.XP -= char.XPNeeded
			char.Level++
			char.XPNeeded = int(float64(char.XPNeeded) * 1.6)
			char.StatPoints += 5
		}

		if levelUps > 0 {
			lvlMsg := fmt.Sprintf("⭐ LEVEL UP! You reached Level %d! Gained +%d stat points!", char.Level, levelUps*5)
			char.Logs = append([]string{lvlMsg}, char.Logs...)
			recalculateCharacter(char)
			char.HP = char.MaxHP
			char.MP = char.MaxMP
		} else {
			recalculateCharacter(char)
		}

		// Reset Quest State
		char.QuestState = QuestState{Active: false}

		db.Save(&user)
		jsonResponse(w, http.StatusOK, map[string]interface{}{"character": char})
		return
	}

	errorResponse(w, http.StatusBadRequest, "Invalid action.")
}

func statsTrainHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	username, ok := getLoggedInUser(r)
	if !ok {
		errorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req TrainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	

	var user User
	if err := db.First(&user, "username = ?", username).Error; err != nil {
		errorResponse(w, http.StatusInternalServerError, "Database error")
		return
	}
	char := &user.Character

	if char.StatPoints <= 0 {
		errorResponse(w, http.StatusBadRequest, "You do not have any Stat Points to spend.")
		return
	}

	switch req.Stat {
	case "strength":
		char.BaseStats.Strength++
	case "intelligence":
		char.BaseStats.Intelligence++
	case "dexterity":
		char.BaseStats.Dexterity++
	case "luck":
		char.BaseStats.Luck++
	default:
		errorResponse(w, http.StatusBadRequest, "Invalid stat specified.")
		return
	}

	char.StatPoints--
	recalculateCharacter(char)

	logMsg := fmt.Sprintf("Trained: Increased base %s by 1.", req.Stat)
	char.Logs = append([]string{logMsg}, char.Logs...)

	db.Save(&user)

	jsonResponse(w, http.StatusOK, map[string]interface{}{"character": char})
}

func shopBuyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	username, ok := getLoggedInUser(r)
	if !ok {
		errorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req BuyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	item, exists := SHOP_ITEMS[req.ItemID]
	if !exists {
		errorResponse(w, http.StatusBadRequest, "Item does not exist in shop.")
		return
	}

	

	var user User
	if err := db.First(&user, "username = ?", username).Error; err != nil {
		errorResponse(w, http.StatusInternalServerError, "Database error")
		return
	}
	char := &user.Character

	if char.Gold < item.Cost {
		errorResponse(w, http.StatusBadRequest, "Insufficient gold to purchase this item.")
		return
	}

	char.Gold -= item.Cost
	char.Inventory = append(char.Inventory, req.ItemID)

	logMsg := fmt.Sprintf("Purchased: %s for %d Gold.", item.Name, item.Cost)
	char.Logs = append([]string{logMsg}, char.Logs...)

	db.Save(&user)

	jsonResponse(w, http.StatusOK, map[string]interface{}{"character": char})
}

func itemActionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	username, ok := getLoggedInUser(r)
	if !ok {
		errorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req ItemActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	

	var user User
	if err := db.First(&user, "username = ?", username).Error; err != nil {
		errorResponse(w, http.StatusInternalServerError, "Database error")
		return
	}
	char := &user.Character

	// Helper to find and remove item from inventory
	findAndRemoveItem := func(id string) bool {
		for index, invID := range char.Inventory {
			if invID == id {
				char.Inventory = append(char.Inventory[:index], char.Inventory[index+1:]...)
				return true
			}
		}
		return false
	}

	if req.Action == "use" {
		if req.ItemID != "potion" {
			errorResponse(w, http.StatusBadRequest, "This item is not consumable.")
			return
		}

		if !findAndRemoveItem("potion") {
			errorResponse(w, http.StatusBadRequest, "Item is not in your inventory.")
			return
		}

		item := SHOP_ITEMS["potion"]
		if char.HP >= char.MaxHP {
			errorResponse(w, http.StatusBadRequest, "Your HP is already full!")
			return
		}

		char.HP += item.HealAmount
		if char.HP > char.MaxHP {
			char.HP = char.MaxHP
		}

		logMsg := fmt.Sprintf("Used Potion: Healed %d HP.", item.HealAmount)
		char.Logs = append([]string{logMsg}, char.Logs...)

		recalculateCharacter(char)
		db.Save(&user)
		jsonResponse(w, http.StatusOK, map[string]interface{}{"character": char})
		return
	}

	if req.Action == "equip" {
		item, exists := SHOP_ITEMS[req.ItemID]
		if !exists || item.Type == "consumable" || item.Slot == nil {
			errorResponse(w, http.StatusBadRequest, "This item is not equippable.")
			return
		}

		if !findAndRemoveItem(req.ItemID) {
			errorResponse(w, http.StatusBadRequest, "Item is not in your inventory.")
			return
		}

		targetSlot := *item.Slot
		var previouslyEquipped *string

		switch targetSlot {
		case "weapon":
			previouslyEquipped = char.Equipment.Weapon
			char.Equipment.Weapon = &req.ItemID
		case "armor":
			previouslyEquipped = char.Equipment.Armor
			char.Equipment.Armor = &req.ItemID
		case "ring":
			previouslyEquipped = char.Equipment.Ring
			char.Equipment.Ring = &req.ItemID
		}

		if previouslyEquipped != nil && *previouslyEquipped != "" {
			char.Inventory = append(char.Inventory, *previouslyEquipped)
			prevItem := SHOP_ITEMS[*previouslyEquipped]
			char.Logs = append([]string{fmt.Sprintf("Unequipped: %s.", prevItem.Name)}, char.Logs...)
		}

		char.Logs = append([]string{fmt.Sprintf("Equipped: %s to %s.", item.Name, targetSlot)}, char.Logs...)
		recalculateCharacter(char)

		db.Save(&user)
		jsonResponse(w, http.StatusOK, map[string]interface{}{"character": char})
		return
	}

	if req.Action == "unequip" {
		if req.Slot == nil {
			errorResponse(w, http.StatusBadRequest, "Slot is required for unequip.")
			return
		}

		var equippedItem *string
		slotName := *req.Slot

		switch slotName {
		case "weapon":
			equippedItem = char.Equipment.Weapon
			char.Equipment.Weapon = nil
		case "armor":
			equippedItem = char.Equipment.Armor
			char.Equipment.Armor = nil
		case "ring":
			equippedItem = char.Equipment.Ring
			char.Equipment.Ring = nil
		default:
			errorResponse(w, http.StatusBadRequest, "Invalid slot specified.")
			return
		}

		if equippedItem == nil || *equippedItem == "" {
			errorResponse(w, http.StatusBadRequest, "No item equipped in this slot.")
			return
		}

		char.Inventory = append(char.Inventory, *equippedItem)
		item := SHOP_ITEMS[*equippedItem]
		char.Logs = append([]string{fmt.Sprintf("Unequipped: %s.", item.Name)}, char.Logs...)

		recalculateCharacter(char)
		db.Save(&user)
		jsonResponse(w, http.StatusOK, map[string]interface{}{"character": char})
		return
	}

	errorResponse(w, http.StatusBadRequest, "Invalid item action.")
}

func adminWarHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	username, ok := getLoggedInUser(r)
	if !ok || username != "admin" {
		errorResponse(w, http.StatusUnauthorized, "Admin only")
		return
	}

	

	factionScores := map[string]int{
		"Go Faction": 0,
		"Rust Faction": 0,
		"Node Faction": 0,
		"Python Faction": 0,
		"Java Faction": 0,
	}

	// Calculate scores
	var users []User
	db.Find(&users)
	for _, u := range users {
		if u.Character.Name == "admin" {
			continue
		}
		
		power := (u.Character.Level * 10) + u.Character.Stats.Strength + u.Character.Stats.Intelligence + u.Character.Stats.Dexterity + u.Character.Stats.Luck
		
		faction := "Go Faction"
		switch u.Character.Class {
		case "GopherWarrior", "RoutineMage": faction = "Go Faction"
		case "FerrisKnight", "BorrowCheckerRogue": faction = "Rust Faction"
		case "NodeNinja", "NodeSummoner": faction = "Node Faction"
		case "PythonRanger", "PythonBerserker": faction = "Python Faction"
		case "JavaKnight", "JavaCleric": faction = "Java Faction"
		}
		
		factionScores[faction] += power
	}

	// Determine winner
	winner := ""
	maxScore := -1
	for f, s := range factionScores {
		if s > maxScore {
			maxScore = s
			winner = f
		}
	}

	// Distribute rewards
	if winner != "" {
		var users []User
		db.Find(&users)
		for _, u := range users {
			if u.Character.Name == "admin" {
				continue
			}
			
			faction := "Go Faction"
			switch u.Character.Class {
			case "GopherWarrior", "RoutineMage": faction = "Go Faction"
			case "FerrisKnight", "BorrowCheckerRogue": faction = "Rust Faction"
			case "NodeNinja", "NodeSummoner": faction = "Node Faction"
			case "PythonRanger", "PythonBerserker": faction = "Python Faction"
			case "JavaKnight", "JavaCleric": faction = "Java Faction"
			}
			
			if faction == winner {
				u.Character.Gold += 500
				u.Character.XP += 1000
				u.Character.Logs = append([]string{fmt.Sprintf("🎊 Your faction (%s) won the War! Received 500G and 1000XP!", winner)}, u.Character.Logs...)
				
				for u.Character.XP >= u.Character.XPNeeded {
					u.Character.Level++
					u.Character.XP -= u.Character.XPNeeded
					u.Character.XPNeeded = int(math.Round(float64(u.Character.XPNeeded) * 1.5))
					u.Character.StatPoints += 3
					u.Character.Logs = append([]string{fmt.Sprintf("Level Up! You are now level %d. (+3 Stat Points)", u.Character.Level)}, u.Character.Logs...)
				}
				
				db.Save(&u)
			} else {
				u.Character.Logs = append([]string{fmt.Sprintf("⚔️ Faction War ended! %s won the war. Try harder next time!", winner)}, u.Character.Logs...)
				db.Save(&u)
			}
		}
		// writeDb(db)
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"message": "Faction war completed",
		"winner": winner,
		"scores": factionScores,
	})
}

type HuntRequest struct {
	MonsterID string `json:"monsterId"`
}

func huntHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	username, ok := getLoggedInUser(r)
	if !ok {
		errorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req HuntRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Monster Data
	type Monster struct {
		Name     string
		PowerReq int
		GoldDrop int
		ExpDrop  int
	}
	monsters := map[string]Monster{
		"planner":   {"기획자 연합", 20, 10, 20},
		"designer":  {"디자인 결사대", 100, 50, 100},
		"qa":        {"QA 군단", 300, 150, 300},
		"executive": {"임원진 의회", 1000, 500, 1000},
	}

	monster, ok := monsters[req.MonsterID]
	if !ok {
		errorResponse(w, http.StatusBadRequest, "Unknown monster")
		return
	}

	

	var user User
	if err := db.First(&user, "username = ?", username).Error; err != nil {
		errorResponse(w, http.StatusInternalServerError, "Database error")
		return
	}
	char := &user.Character

	power := (char.Level * 10) + char.Stats.Strength + char.Stats.Intelligence + char.Stats.Dexterity + char.Stats.Luck

	var logMsg string
	won := false

	if power >= monster.PowerReq {
		won = true
		char.Gold += monster.GoldDrop
		char.XP += monster.ExpDrop
		
		logMsg = fmt.Sprintf("사냥 성공! [%s] 처치. +%d Gold, +%d XP.", monster.Name, monster.GoldDrop, monster.ExpDrop)
		
		// Level Up check
		if char.XP >= char.Level*100 {
			char.XP -= char.Level * 100
			char.Level++
			char.MaxHP += 20
			char.HP = char.MaxHP
			char.StatPoints += 5
			logMsg += " 레벨 업!"
		}
	} else {
		damage := monster.PowerReq - power
		if damage > 30 {
			damage = 30
		}
		if damage < 5 {
			damage = 5
		}
		char.HP -= damage
		if char.HP <= 0 {
			char.HP = 0
			logMsg = fmt.Sprintf("사냥 실패... [%s]에게 패배하여 쓰러졌습니다.", monster.Name)
		} else {
			logMsg = fmt.Sprintf("사냥 실패... [%s]의 반격으로 %d HP를 잃었습니다.", monster.Name, damage)
		}
	}

	char.Logs = append([]string{logMsg}, char.Logs...)
	
	db.Save(&user)

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"character": char,
		"won":       won,
		"log":       logMsg,
	})
}

// --- Multiplayer Handlers ---

func activePlayersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	// Active in last 10 minutes
	tenMinsAgo := time.Now().Add(-10 * time.Minute)
	var activeUsers []User
	if err := db.Where("last_active_at > ?", tenMinsAgo).Order("last_active_at desc").Limit(20).Find(&activeUsers).Error; err != nil {
		errorResponse(w, http.StatusInternalServerError, "Failed to fetch active players")
		return
	}
	
	type ActivePlayer struct {
		Username string `json:"username"`
		CharName string `json:"charName"`
		Class    string `json:"class"`
		Level    int    `json:"level"`
	}
	var res []ActivePlayer
	for _, u := range activeUsers {
		res = append(res, ActivePlayer{
			Username: u.Username,
			CharName: u.Character.Name,
			Class:    u.Character.Class,
			Level:    u.Character.Level,
		})
	}
	jsonResponse(w, http.StatusOK, res)
}

func chatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		var msgs []ChatMessage
		db.Order("created_at desc").Limit(50).Find(&msgs)
		// Reverse to chronological
		for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
			msgs[i], msgs[j] = msgs[j], msgs[i]
		}
		jsonResponse(w, http.StatusOK, msgs)
		return
	}
	
	if r.Method == http.MethodPost {
		username, ok := getLoggedInUser(r)
		if !ok {
			errorResponse(w, http.StatusUnauthorized, "Not logged in")
			return
		}
		
		var req struct {
			Message string `json:"message"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Message) == "" {
			errorResponse(w, http.StatusBadRequest, "Invalid message")
			return
		}
		
		var user User
		if err := db.First(&user, "username = ?", username).Error; err != nil {
			errorResponse(w, http.StatusNotFound, "User not found")
			return
		}
		
		msg := ChatMessage{
			Username: user.Username,
			CharName: user.Character.Name,
			Class:    user.Character.Class,
			Message:  strings.TrimSpace(req.Message),
		}
		db.Create(&msg)
		jsonResponse(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}
	
	errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
}

func interactHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	
	username, ok := getLoggedInUser(r)
	if !ok {
		errorResponse(w, http.StatusUnauthorized, "Not logged in")
		return
	}
	
	var req struct {
		TargetUsername string `json:"targetUsername"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}
	
	var sender, target User
	if err := db.First(&sender, "username = ?", username).Error; err != nil {
		return
	}
	if err := db.First(&target, "username = ?", req.TargetUsername).Error; err != nil {
		errorResponse(w, http.StatusNotFound, "Target user not found")
		return
	}
	
	logMsg := fmt.Sprintf("👋 %s님이 당신에게 손을 흔들었습니다!", sender.Character.Name)
	target.Character.Logs = append([]string{logMsg}, target.Character.Logs...)
	db.Save(&target)
	
	jsonResponse(w, http.StatusOK, map[string]string{"status": "ok"})
}

// --- Main Server Setup ---

func main() {
	initDB()
	// API Route mappings
	http.HandleFunc("/api/register", registerHandler)
	http.HandleFunc("/api/login", loginHandler)
	http.HandleFunc("/api/link-account", linkAccountHandler)
	http.HandleFunc("/api/logout", logoutHandler)
	http.HandleFunc("/api/me", meHandler)
	http.HandleFunc("/api/quest", questHandler)
	http.HandleFunc("/api/stats/train", statsTrainHandler)
	http.HandleFunc("/api/shop/buy", shopBuyHandler)
	http.HandleFunc("/api/item/action", itemActionHandler)
	http.HandleFunc("/api/admin/war", adminWarHandler)
	http.HandleFunc("/api/hunt", huntHandler)
	http.HandleFunc("/api/active-players", activePlayersHandler)
	http.HandleFunc("/api/chat", chatHandler)
	http.HandleFunc("/api/interact", interactHandler)

	// Serve frontend static assets from public folder
	publicPath := filepath.Join(".", "public")
	
	// Root and asset router
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Set aggressive no-cache headers for development
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")

		// Prevent serving directory listings
		path := filepath.Join(publicPath, filepath.Clean(r.URL.Path))
		info, err := os.Stat(path)

		if r.URL.Path == "/" || r.URL.Path == "/index.html" || (err == nil && info.IsDir()) {
			type TemplateData struct {
				LoggedIn      bool
				Role          string
				CharacterJSON template.JS
				IsGuest       bool
			}
			data := TemplateData{LoggedIn: false}

			username, ok := getLoggedInUser(r)
			if ok {
				var user User
				exists := (db.First(&user, "username = ?", username).Error == nil)
				if exists {
					data.LoggedIn = true
						if username == "admin" {
							data.Role = "admin"
						} else {
							data.Role = "user"
						}
						
						charBytes, _ := json.Marshal(user.Character)
						data.CharacterJSON = template.JS(charBytes)
						data.IsGuest = user.IsGuest
					}
			}

			tmpl, err := template.ParseFiles(filepath.Join(".", "templates", "index.html"))
			if err != nil {
				http.Error(w, "Template error", http.StatusInternalServerError)
				return
			}
			tmpl.Execute(w, data)
			return
		}
		
		// If path doesn't exist, route back to index.html (SPA support)
		if os.IsNotExist(err) && !strings.HasPrefix(r.URL.Path, "/api/") {
			http.Redirect(w, r, "/", http.StatusFound)
			return
		}

		http.FileServer(http.Dir(publicPath)).ServeHTTP(w, r)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	fmt.Printf("RPG Portal Server (Go) running at http://localhost:%s\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal("Server failed:", err)
	}
}
