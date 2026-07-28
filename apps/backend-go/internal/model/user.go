package model

import "time"

// User 对应用户实体
type User struct {
	ID        string    `db:"id" json:"id"`
	Username  string    `db:"username" json:"username"`
	Name      string    `db:"name" json:"name"`
	Role      string    `db:"role" json:"role"`
	Status    string    `db:"status" json:"status"`
	Password  string    `db:"password" json:"-"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

