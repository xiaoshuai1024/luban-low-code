package main

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

// 小工具：生成 bcrypt 哈希，方便初始化 SQL 使用。
// 使用方式：
//   go run ./tools/gen_hash.go
// 终端输出的字符串可直接填入 users.password 字段。
func main() {
	password := "123456"

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}

	fmt.Println(string(hash))
}

